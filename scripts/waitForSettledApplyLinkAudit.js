import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import "../loadEnv.js";
import connectDB from "../db/db.js";
import Job from "../src/models/Job.js";
import JobDatasetSummary from "../src/models/JobDatasetSummary.js";
import { JOB_DATASET_SUMMARY_KEY } from "../src/services/jobDatasetSummaryService.js";
import {
  auditJobLinks,
  buildAuditDatasetConfig,
  getDeadJobCandidatesFromReport,
  waitForStableDataset,
} from "./lib/jobLinkAudit.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceArtifactsDir = path.resolve(currentDir, "../../artifacts/job-link-audits");
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_POLL_MS = 60000;
const DEFAULT_MAX_ATTEMPTS = 120;

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const findArgValue = (name) => {
  const prefix = `${name}=`;
  const direct = process.argv.find((value) => value.startsWith(prefix));
  return direct ? direct.slice(prefix.length) : null;
};

const buildDefaultOutputPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(workspaceArtifactsDir, `settled-apply-link-audit-${timestamp}.json`);
};

const projection = {
  title: 1,
  company: 1,
  source: 1,
  applyUrl: 1,
  sourceUrl: 1,
  atsPlatform: 1,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadSnapshot() {
  throw new Error("loadSnapshot requires a dataset config.");
}

async function loadScopedSnapshot(datasetConfig) {
  const [summaryDocument, scopedJobCount] = await Promise.all([
    datasetConfig.scope === "public"
      ? JobDatasetSummary.findOne({ key: JOB_DATASET_SUMMARY_KEY }).lean().exec()
      : Promise.resolve(null),
    Job.countDocuments(datasetConfig.query),
  ]);
  const baselineJobCount = datasetConfig.scope === "public"
    ? summaryDocument?.totalJobs ?? null
    : scopedJobCount;
  return {
    summaryDocument,
    summaryTotalJobs: baselineJobCount,
    activeJobCount: scopedJobCount,
  };
}

async function main() {
  const auditNow = new Date();
  const concurrency = toInt(findArgValue("--concurrency"), DEFAULT_CONCURRENCY);
  const timeoutMs = toInt(findArgValue("--timeout-ms"), DEFAULT_TIMEOUT_MS);
  const pollMs = toInt(findArgValue("--poll-ms"), DEFAULT_POLL_MS);
  const maxAttempts = toInt(findArgValue("--max-attempts"), DEFAULT_MAX_ATTEMPTS);
  const expectedCount = toInt(findArgValue("--expected-count"), 0) || null;
  const outputPath = path.resolve(findArgValue("--output") || buildDefaultOutputPath());
  const datasetConfig = buildAuditDatasetConfig({
    scope: findArgValue("--scope"),
    now: auditNow,
  });
  const minStablePolls = datasetConfig.scope === "all" ? 2 : 1;

  await connectDB();

  const settled = await waitForStableDataset({
    expectedTotalJobs: expectedCount,
    maxAttempts,
    pollIntervalMs: pollMs,
    minStablePolls,
    baselineLabel: datasetConfig.baselineLabel,
    snapshotLabel: datasetConfig.snapshotLabel,
    sleep,
    getSnapshot: async () => {
      const snapshot = await loadScopedSnapshot(datasetConfig);
      return {
        summaryTotalJobs: snapshot.summaryTotalJobs,
        activeJobCount: snapshot.activeJobCount,
      };
    },
    onPoll: (status) => {
      console.log(JSON.stringify({
        phase: "poll",
        attempt: status.attempt,
        maxAttempts: status.maxAttempts,
        minStablePolls: status.minStablePolls,
        stableStreak: status.stableStreak,
        summaryTotalJobs: status.summaryTotalJobs,
        activeJobCount: status.activeJobCount,
        expectedTotalJobs: status.expectedTotalJobs,
        isStable: status.isStable,
        reason: status.reason,
      }));
    },
  });

  const snapshot = await loadScopedSnapshot(datasetConfig);
  const jobs = await Job.find(datasetConfig.query, projection).lean().exec();
  const report = await auditJobLinks({
    jobs,
    summaryTotalJobs: snapshot.summaryTotalJobs,
    expectedTotalJobs: expectedCount,
    baselineLabel: datasetConfig.baselineLabel,
    snapshotLabel: datasetConfig.snapshotLabel,
    fetchImpl: fetch,
    allowCountMismatch: false,
    concurrency,
    timeoutMs,
    now: auditNow,
  });

  const output = {
    ...report,
    options: {
      scope: datasetConfig.scope,
      concurrency,
      timeoutMs,
      pollMs,
      maxAttempts,
      minStablePolls,
      expectedCount,
    },
    settledStatus: settled,
    dataset: {
      scope: datasetConfig.scope,
      label: datasetConfig.label,
      baselineJobCount: snapshot.summaryTotalJobs,
      scopedJobCount: snapshot.activeJobCount,
      auditedJobCount: jobs.length,
      summaryRefreshedAt: snapshot.summaryDocument?.refreshedAt ?? null,
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    phase: "complete",
    outputPath,
    datasetStability: output.datasetStability,
    summary: output.summary,
    deadCandidates: getDeadJobCandidatesFromReport(output).length,
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("Settled apply-link audit failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
