import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import Click from "../src/models/Click.js";
import Job from "../src/models/Job.js";
import JobDatasetSummary from "../src/models/JobDatasetSummary.js";
import Subscription from "../src/models/Subscription.js";
import User from "../src/models/User.js";
import BlacklistedToken from "../src/models/BlacklistedToken.js";
import { ACCESS_ROLES, PLAN_IDS } from "../src/constants/accessPlans.js";
import { refreshJobDatasetSummary } from "../src/services/jobDatasetSummaryService.js";
import { normalizeEmailAddress } from "../src/utils/authSecurity.js";
import { buildJobDerivedFields } from "../src/utils/jobDerivedFields.js";
import { buildJobSearchKeys } from "../src/utils/jobSearchKeys.js";
import { seedJobProfileFixtures } from "./lib/jobProfileFixtures.js";
import { runIndexManagement } from "./indexes.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..");
const frontendDir = path.resolve(repoRoot, "jobverify-frontend");
const backendDir = path.resolve(repoRoot, "jobverify-backend");
const mongoBinaryCacheDir = path.resolve(repoRoot, "artifacts", "mongodb-binaries");

process.env.MONGOMS_DOWNLOAD_DIR = process.env.MONGOMS_DOWNLOAD_DIR || mongoBinaryCacheDir;
process.env.MONGOMS_PREFER_GLOBAL_PATH = "false";

const FRONTEND_HOST = process.env.JOBVERIFY_FRONTEND_HOST || "127.0.0.1";
const BACKEND_HOST = process.env.JOBVERIFY_BACKEND_HOST || "127.0.0.1";
const hasRequestedFrontendPort = Boolean(process.env.JOBVERIFY_FRONTEND_PORT);
const hasRequestedBackendPort = Boolean(process.env.JOBVERIFY_BACKEND_PORT);
let FRONTEND_PORT = Number(process.env.JOBVERIFY_FRONTEND_PORT || 4173);
let BACKEND_PORT = Number(process.env.JOBVERIFY_BACKEND_PORT || 5090);
let FRONTEND_ORIGIN = `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;
let BACKEND_ORIGIN = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const TOTAL_JOBS = Number(process.env.JOBVERIFY_E2E_TOTAL_JOBS || 1800);
const E2E_EMAIL = normalizeEmailAddress(
  process.env.JOBVERIFY_E2E_EMAIL || "student@example.edu",
);
const E2E_PASSWORD = process.env.JOBVERIFY_E2E_PASSWORD || "Password123A";
const E2E_USER_NAME = process.env.JOBVERIFY_E2E_USER_NAME || "Jobverify E2E User";
const E2E_ADMIN_EMAIL = normalizeEmailAddress(process.env.JOBVERIFY_E2E_ADMIN_EMAIL || "");
const E2E_ADMIN_PASSWORD = process.env.JOBVERIFY_E2E_ADMIN_PASSWORD || "";
const E2E_ADMIN_NAME = process.env.JOBVERIFY_E2E_ADMIN_NAME || "Jobverify E2E Admin";
const AUDIT_COMPANY = process.env.JOBVERIFY_E2E_SENTINEL_COMPANY || "Audit Signal Labs";
const AUDIT_TITLE = process.env.JOBVERIFY_E2E_SENTINEL_TITLE || "Audit Signal Frontend Intern";
const AUDIT_SOURCE_URL = "https://example.com/jobs/audit-signal-frontend-intern";
const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_TIMEOUT_MS = 120_000;
const STACK_SHUTDOWN_TIMEOUT_MS = 10_000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const STRONG_JWT_SECRET =
  process.env.JOBVERIFY_E2E_JWT_SECRET || "12345678901234567890123456789012";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const trackedChildren = [];
let mongoServer = null;
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForChildExit = (child) => once(child, "exit").catch(() => null);
const daysFromNow = (days) => new Date(Date.now() + days * DAY_IN_MS);
const reserveAvailablePort = (host, preferredPort, { allowFallback, label }) =>
  new Promise((resolve, reject) => {
    const tryReserve = (port) => {
      const server = net.createServer();
      server.unref();

      server.once("error", (error) => {
        if (error?.code === "EADDRINUSE" && allowFallback && port !== 0) {
          tryReserve(0);
          return;
        }

        if (error?.code === "EADDRINUSE") {
          reject(new Error(`${label} port ${preferredPort} is already in use.`));
          return;
        }

        reject(new Error(`Could not reserve a ${label} port: ${error?.message ?? error}`));
      });

      server.listen(port, host, () => {
        const address = server.address();
        const reservedPort =
          typeof address === "object" && address ? address.port : preferredPort;

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(reservedPort);
        });
      });
    };

    tryReserve(preferredPort);
  });

const prefixOutput = (stream, label) => {
  if (!stream) return;

  let buffered = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/u);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        process.stdout.write(`[${label}] ${line}\n`);
      }
    }
  });
  stream.on("end", () => {
    if (buffered.length > 0) {
      process.stdout.write(`[${label}] ${buffered}\n`);
      buffered = "";
    }
  });
};

const forceKillChildTree = async (child) => {
  if (!child?.pid) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await once(killer, "exit").catch(() => null);
    return;
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
};

const terminateChild = async (child) => {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  const exitPromise = waitForChildExit(child);
  child.kill(process.platform === "win32" ? undefined : "SIGTERM");
  const exitedCleanly = await Promise.race([
    exitPromise.then(() => true),
    sleep(STACK_SHUTDOWN_TIMEOUT_MS).then(() => false),
  ]);

  if (!exitedCleanly && child.exitCode === null) {
    await forceKillChildTree(child);
    await Promise.race([exitPromise, sleep(STACK_SHUTDOWN_TIMEOUT_MS)]);
  }
};

const cleanup = async (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await Promise.allSettled(trackedChildren.map(({ child }) => terminateChild(child)));
  await mongoose.disconnect().catch(() => null);
  await mongoServer?.stop().catch(() => null);
  process.exit(exitCode);
};

const monitorChild = (name, child) => {
  trackedChildren.push({ name, child });
  prefixOutput(child.stdout, name);
  prefixOutput(child.stderr, `${name}:err`);

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    process.stderr.write(`[stack] ${name} exited unexpectedly with ${detail}\n`);
    void cleanup(1);
  });
};

const waitForHealthyUrl = async (url, label) => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }

      lastError = new Error(`${label} responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(HEALTH_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for ${label} at ${url}: ${lastError?.message ?? "unreachable"}`,
  );
};

const spawnNpmProcess = (args, options) => {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/c", npmCommand, ...args], {
      ...options,
      windowsHide: true,
    });
  }

  return spawn(npmCommand, args, options);
};

const runForegroundCommand = async (name, command, args, options) => {
  const child = spawn(command, args, options);
  prefixOutput(child.stdout, name);
  prefixOutput(child.stderr, `${name}:err`);

  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    throw new Error(`${name} exited unexpectedly with ${detail}`);
  }
};

const createAuditSentinelJob = async () => {
  const baseJob = await Job.findOne({
    title: "Frontend Developer Intern",
    company: "Google",
  }).lean();

  if (!baseJob) {
    throw new Error("Could not locate the canonical fixture job used for the local audit.");
  }

  // Keep the sentinel job recent so latest-sort and date-posted filters stay stable over time.
  const postedAt = daysFromNow(-2);
  const nextJob = {
    ...baseJob,
    _id: new mongoose.Types.ObjectId(),
    title: AUDIT_TITLE,
    originalTitle: AUDIT_TITLE,
    normalizedTitle: AUDIT_TITLE.toLowerCase(),
    company: AUDIT_COMPANY,
    sourceUrl: AUDIT_SOURCE_URL,
    applyUrl: `${AUDIT_SOURCE_URL}/apply`,
    companyCareerPage: "https://example.com/careers/audit-signal",
    jobId: "fixture-audit-signal-frontend-intern",
    requisitionId: "REQ-AUDIT-0001",
    fingerprint: "fixture-audit-signal-frontend-intern",
    postedAt,
    sortDate: postedAt,
    scrapedAt: postedAt,
    scrapedTimestamp: postedAt,
    lastSeenAt: postedAt,
    createdAt: postedAt,
    updatedAt: postedAt,
    clickCount: 999,
  };

  delete nextJob.__v;
  delete nextJob.id;
  delete nextJob.applicationStatus;
  delete nextJob.applicationStatusReason;
  delete nextJob.applicationUrl;

  Object.assign(nextJob, buildJobSearchKeys(nextJob), buildJobDerivedFields(nextJob));

  await Job.create(nextJob);
  return nextJob;
};

const seedLocalState = async () => {
  await Promise.all([
    Click.deleteMany({}),
    BlacklistedToken.deleteMany({}),
    Subscription.deleteMany({}),
    User.deleteMany({}),
    Job.deleteMany({}),
    JobDatasetSummary.deleteMany({}),
  ]);

  const seedInfo = await seedJobProfileFixtures(Job, { totalJobs: TOTAL_JOBS, referenceDate: new Date() });
  const auditJob = await createAuditSentinelJob();
  await refreshJobDatasetSummary();

  const hashedPassword = await bcrypt.hash(E2E_PASSWORD, 10);
  const premiumStartedAt = daysFromNow(-14);
  const premiumExpiresAt = daysFromNow(365);

  await User.create({
    email: E2E_EMAIL,
    password: hashedPassword,
    role: "user",
    accessRole: ACCESS_ROLES.SEMESTER,
    premium: {
      planId: PLAN_IDS.SEMESTER,
      status: "active",
      startedAt: premiumStartedAt,
      expiresAt: premiumExpiresAt,
      telegramAlertsEnabled: false,
    },
    profile: {
      name: E2E_USER_NAME,
      branch: "CSE",
      passingYear: 2027,
      preferredJobTypes: ["Intern", "Full-time Fresher"],
      locationPreference: ["Bangalore"],
      profilePreferenceFilters: {
        company: [],
        jobType: [],
        location: [],
        experienceYear: "",
        roleDomain: [],
        workArrangement: [],
        datePostedDays: [],
        sortBy: "latest",
      },
    },
    onboardingCompleted: true,
    isVerified: true,
    deactivated: false,
    lastLoginAt: daysFromNow(-1),
  });

  if (E2E_ADMIN_EMAIL && E2E_ADMIN_PASSWORD) {
    const hashedAdminPassword = await bcrypt.hash(E2E_ADMIN_PASSWORD, 10);

    await User.create({
      email: E2E_ADMIN_EMAIL,
      password: hashedAdminPassword,
      role: "admin",
      accessRole: ACCESS_ROLES.YEARLY,
      premium: {
        planId: PLAN_IDS.YEARLY,
        status: "active",
        startedAt: premiumStartedAt,
        expiresAt: premiumExpiresAt,
        telegramAlertsEnabled: false,
      },
      profile: {
        name: E2E_ADMIN_NAME,
        branch: "CSE",
        passingYear: 2024,
        preferredJobTypes: ["Intern", "Full-time Experienced"],
        locationPreference: ["Bangalore"],
        profilePreferenceFilters: {
          company: [],
          jobType: [],
          location: [],
          experienceYear: "",
          roleDomain: [],
          workArrangement: [],
          datePostedDays: [],
          sortBy: "latest",
        },
      },
      onboardingCompleted: true,
      isVerified: true,
      deactivated: false,
      lastLoginAt: daysFromNow(-1),
    });
  }

  const previousAck = process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS = "true";
  process.env.NODE_ENV = "test";
  try {
    await runIndexManagement({
      mode: "apply",
      dryRun: false,
      shouldConnect: false,
      shouldDisconnect: false,
      log: () => {},
      errorLog: console.error,
    });
  } finally {
    if (previousAck == null) {
      delete process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS;
    } else {
      process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS = previousAck;
    }

    if (previousNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }

  return {
    seedInfo,
    auditJob,
  };
};

const spawnBackend = (mongoUri) => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: backendDir,
    windowsHide: true,
    env: {
      ...process.env,
      MONGO_URI: mongoUri,
      NODE_ENV: "test",
      PORT: String(BACKEND_PORT),
      JWT_SECRET: STRONG_JWT_SECRET,
      CORS_ORIGIN: FRONTEND_ORIGIN,
      FRONTEND_ORIGIN,
      TURNSTILE_SECRET_KEY: "",
      TRUST_PROXY: "false",
      TELEGRAM_ENABLED: "false",
      TAILORED_RESUME_ACTIONS_ENABLED: "false",
      GITHUB_PAT: "",
      GITHUB_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  monitorChild("backend", child);
  return child;
};

const createFrontendEnv = () => ({
  ...process.env,
  VITE_API_BASE_URL: BACKEND_ORIGIN,
  VITE_DISABLE_TURNSTILE: "true",
  VITE_TURNSTILE_SITE_KEY: "",
});

const buildFrontend = async () => {
  // The npm build script chains several commands: trailing npm arguments reach
  // its final command, not Vite. Pass the local mode directly to Vite.
  const child = spawn(process.execPath, [path.join(frontendDir, 'node_modules/vite/bin/vite.js'), 'build', '--configLoader', 'runner', '--mode', 'local-e2e'], {
    cwd: frontendDir,
    windowsHide: true,
    env: createFrontendEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  prefixOutput(child.stdout, "frontend:build");
  prefixOutput(child.stderr, "frontend:build:err");

  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    throw new Error(`frontend:build exited unexpectedly with ${detail}`);
  }
};

const spawnFrontend = () => {
  const child = spawnNpmProcess(
    ["run", "preview", "--", "--mode", "local-e2e", "--host", FRONTEND_HOST, "--port", String(FRONTEND_PORT), "--strictPort"],
    {
      cwd: frontendDir,
      env: createFrontendEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  monitorChild("frontend", child);
  return child;
};

async function main() {
  process.on("SIGINT", () => {
    void cleanup(0);
  });
  process.on("SIGTERM", () => {
    void cleanup(0);
  });

  FRONTEND_PORT = await reserveAvailablePort(FRONTEND_HOST, FRONTEND_PORT, {
    allowFallback: !hasRequestedFrontendPort,
    label: "frontend",
  });
  BACKEND_PORT = await reserveAvailablePort(BACKEND_HOST, BACKEND_PORT, {
    allowFallback: !hasRequestedBackendPort,
    label: "backend",
  });
  FRONTEND_ORIGIN = `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;
  BACKEND_ORIGIN = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

  await fs.mkdir(mongoBinaryCacheDir, { recursive: true });
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      dbName: "jobverify-local-e2e",
      ip: BACKEND_HOST,
    },
    binary: {
      version: '8.2.6',
      downloadDir: mongoBinaryCacheDir,
    },
  });

  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  const { seedInfo, auditJob } = await seedLocalState();
  if (process.env.JOBVERIFY_E2E_CANDIDATE_WORKFLOW === 'true') {
    const owner = await User.findOneAndUpdate({ email: E2E_EMAIL }, { $addToSet: { savedJobs: auditJob._id } }, { new: true });
    await Job.updateOne({ _id: auditJob._id }, { $set: { requiredSkills: ['React', 'JavaScript'] } });
    const { seedCandidateWorkflowCv } = await import('./lib/candidateWorkflowCvFixture.js');
    await seedCandidateWorkflowCv({ userId: owner._id, jobId: auditJob._id });
  }
  await mongoose.disconnect();

  await buildFrontend();
  spawnBackend(mongoUri);
  spawnFrontend();

  await Promise.all([
    waitForHealthyUrl(`${BACKEND_ORIGIN}/health`, "backend"),
    waitForHealthyUrl(FRONTEND_ORIGIN, "frontend"),
  ]);

  process.stdout.write(
    `${JSON.stringify({
      event: "jobverify_local_e2e_stack_ready",
      frontendOrigin: FRONTEND_ORIGIN,
      backendOrigin: BACKEND_ORIGIN,
      seededEmail: E2E_EMAIL,
      seededAdminEmail: E2E_ADMIN_EMAIL || null,
      totalJobs: seedInfo.totalJobs + 1,
      canonicalAuditCompany: AUDIT_COMPANY,
      canonicalAuditTitle: auditJob.title,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[stack] ${error.stack || error.message}\n`);
  void cleanup(1);
});
