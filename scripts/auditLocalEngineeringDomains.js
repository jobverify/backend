import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBrowserFetchSession } from "../scraper-support/shared/browserFetch.js";
import {
  inferExperienceFromPublicPageHtml,
  resolvePublicJobUrl,
} from "../scraper-support/utils/publicExperienceEnrichment.js";
import { normalizeScrapedJob } from "../scraper-support/utils/normalizeScrapedJob.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 10000;
const TECHNICAL_TITLE_HINT_PATTERN = /\b(engineer|developer|devops|sre|architect|programmer|scientist|data analyst|data analytics|data science|data engineering|d&a|consumer ai|ai unit|agentic ai|computer vision|gen ai|generative ai|llm|sap\b|oracle\b|palantir|power ?bi|linux bsp|rtos|mixed signal|guidewire|mulesoft|aem|d365|ms dynamics|react|node\.?js|documentum|adobe campaign|uipath|outsystem|rpa\b|mep|hvac|bim|power electronics|electronics|instrumentation|cyber\s*security|security analyst|qa|quality|test(?: lead| analyst| automation| engineer|ing)?|validation|network|cloud|infrastructure|platform engineer|support engineer|support analyst|field service|application engineer|administrator|sysadmin|embedded|firmware|semiconductor|pcb|electrical|mechanical|civil|automation|robotics|uav)\b/i;
const TECHNICAL_ROLE_DOMAINS = new Set([
  "Backend Engineering",
  "Frontend Engineering",
  "Full-Stack Engineering",
  "Mobile Development",
  "Software Engineering",
  "Quality Engineering",
  "DevOps & SRE",
  "Cloud & Infrastructure",
  "Data Engineering",
  "Data Science & AI",
  "Cybersecurity",
]);
const NON_TECHNICAL_ROLE_DOMAINS = new Set([
  "Sales & Customer Success",
  "Finance & Operations",
  "Legal & Compliance",
  "Marketing & Communications",
  "Human Resources",
  "Product & Program Management",
  "Design & UX",
]);
const NON_TECHNICAL_TITLE_EXCLUSION_PATTERN = /\b(medical consultant|territory service manager|account manager|monitoring\s*&\s*testing independence|current openings at|recruitment of engineer trainees|design consultant)\b|^test$/i;
const TECHNICAL_OVERRIDE_PATTERN = /\b(ai|analytics|data|software|cloud|security|cyber|devops|linux|database|sap\b|oracle\b|palantir|power ?bi|embedded|firmware|semiconductor|electronics|power|hvac|mep|instrumentation|architect)\b/i;
const BROWSER_FALLBACK_ATS_PLATFORMS = new Set([
  "agenticweb-graphql",
  "eightfold-pcsx",
]);
const BROWSER_RETRY_ERROR_PATTERN = /\b(401|403|408|429|500|502|503|504|timeout)\b/i;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const scraperDir = path.resolve(currentDir, "../scraper");
const workspaceArtifactsDir = path.resolve(currentDir, "../../artifacts/engineering-domain-audits");

const parseIntegerFlag = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseStringFlag = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

const shouldWrite = process.argv.includes("--write");
const concurrency = parseIntegerFlag("concurrency", DEFAULT_CONCURRENCY);
const timeoutMs = parseIntegerFlag("timeout-ms", DEFAULT_TIMEOUT_MS);
const limit = parseIntegerFlag("limit", 0);
const sourceFilter = parseStringFlag("source");
const browserMode = (parseStringFlag("browser") || "smart").toLowerCase();

const buildDefaultOutputPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(workspaceArtifactsDir, `local-engineering-domain-audit-${timestamp}.json`);
};

const outputPath = path.resolve(parseStringFlag("output") || buildDefaultOutputPath());
const selectedSources = sourceFilter
  ? new Set(sourceFilter.split(",").map((value) => value.trim()).filter(Boolean))
  : null;

const toText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const toIsoOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
};

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
};

const serializeError = (error) => {
  if (!error) return null;
  return {
    name: error.name || "Error",
    message: String(error.message || error),
  };
};

const incrementMap = (map, key) => {
  map.set(key, (map.get(key) || 0) + 1);
};

const isTechnicalUnknownCandidate = (job = {}) => {
  if (job.engineeringDomain !== "Unknown") return false;

  const titleParts = [job.title, job.jobCategory].filter(Boolean).map((value) => String(value).trim());
  if (titleParts.some((value) => /^test$/i.test(value))) return false;
  const titleEvidence = titleParts.join(" ");
  if (NON_TECHNICAL_TITLE_EXCLUSION_PATTERN.test(titleEvidence)) return false;
  const roleDomain = String(job.primaryRoleDomain || "").trim();
  const hasTechnicalTitleHint = TECHNICAL_TITLE_HINT_PATTERN.test(titleEvidence);
  const hasTechnicalRoleDomain = TECHNICAL_ROLE_DOMAINS.has(roleDomain);
  if (!hasTechnicalTitleHint && !hasTechnicalRoleDomain) return false;
  if (!NON_TECHNICAL_ROLE_DOMAINS.has(roleDomain)) return true;
  return TECHNICAL_OVERRIDE_PATTERN.test(titleEvidence);
};

const createSourceBucket = () => ({
  totalJobs: 0,
  normalizedUnknown: 0,
  nonTechnicalUnknown: 0,
  auditedCandidates: 0,
  recovered: 0,
  confirmedUnknown: 0,
  unverified: 0,
  experienceRecovered: 0,
});

const buildResultRow = ({
  source,
  before,
  after,
  usedDefaultFetch,
  usedBrowserFetch,
  defaultFetchError,
  browserFetchError,
}) => {
  const beforeDescription = toText(before.jobDescription || before.description);
  const afterDescription = toText(after.jobDescription || after.description);
  const recovered = after.engineeringDomain !== "Unknown";
  const experienceChanged = toText(before.experienceRequired) !== toText(after.experienceRequired);
  const descriptionChanged = beforeDescription !== afterDescription;
  const defaultFetchSucceeded = usedDefaultFetch && !defaultFetchError;
  const browserFetchSucceeded = usedBrowserFetch && !browserFetchError;
  const wasVerified = defaultFetchSucceeded || browserFetchSucceeded;
  const classification = recovered
    ? "recovered"
    : wasVerified
      ? "confirmed_unknown"
      : "unverified";

  return {
    source,
    company: after.company || before.company || null,
    title: after.title || before.title || null,
    applyUrl: after.applyUrl || before.applyUrl || null,
    sourceUrl: after.sourceUrl || before.sourceUrl || null,
    priorEngineeringDomain: before.engineeringDomain,
    finalEngineeringDomain: after.engineeringDomain,
    priorPrimaryRoleDomain: before.primaryRoleDomain || null,
    finalPrimaryRoleDomain: after.primaryRoleDomain || null,
    priorExperienceRequired: before.experienceRequired || null,
    finalExperienceRequired: after.experienceRequired || null,
    experienceChanged,
    descriptionChanged,
    usedDefaultFetch,
    usedBrowserFetch,
    defaultFetchSucceeded,
    browserFetchSucceeded,
    defaultFetchError,
    browserFetchError,
    classification,
  };
};

const shouldUseBrowserFallback = ({ before, after, usedDefaultFetch, defaultFetchError }) => {
  if (browserMode === "never") return false;
  if (browserMode === "always") return true;
  if (defaultFetchError) {
    return BROWSER_RETRY_ERROR_PATTERN.test(String(defaultFetchError.message || ""));
  }
  if (!usedDefaultFetch) return false;
  if (after.engineeringDomain !== "Unknown") return false;
  if (toText(after.jobDescription || after.description)) return false;
  return BROWSER_FALLBACK_ATS_PLATFORMS.has(String(before.atsPlatform || "").trim().toLowerCase());
};

async function main() {
  const auditStartedAt = new Date();
  const directoryEntries = (await fs.readdir(scraperDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !selectedSources || selectedSources.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));

  const files = [];
  const candidates = [];
  const sourceSummary = new Map();
  const summary = {
    scannedCompanies: directoryEntries.length,
    companiesWithJobs: 0,
    totalJobs: 0,
    normalizedUnknown: 0,
    nonTechnicalUnknown: 0,
    auditedCandidates: 0,
    recovered: 0,
    confirmedUnknown: 0,
    unverified: 0,
    experienceRecovered: 0,
    browserFallbackUsed: 0,
    changedFiles: 0,
  };

  for (const entry of directoryEntries) {
    const jobsPath = path.join(scraperDir, entry.name, "jobs.json");
    let rawJobs;

    try {
      rawJobs = JSON.parse(await fs.readFile(jobsPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    if (!Array.isArray(rawJobs)) continue;

    summary.companiesWithJobs += 1;
    const sourceBucket = sourceSummary.get(entry.name) || createSourceBucket();
    const normalizedJobs = new Array(rawJobs.length);
    files.push({
      source: entry.name,
      jobsPath,
      originalJobs: rawJobs,
      normalizedJobs,
      changed: false,
    });

    for (let index = 0; index < rawJobs.length; index += 1) {
      const baseNormalized = normalizeScrapedJob(rawJobs[index], {
        source: rawJobs[index]?.source || entry.name,
      });

      normalizedJobs[index] = baseNormalized;
      summary.totalJobs += 1;
      sourceBucket.totalJobs += 1;

      if (baseNormalized.engineeringDomain !== "Unknown") continue;

      summary.normalizedUnknown += 1;
      sourceBucket.normalizedUnknown += 1;

      if (!isTechnicalUnknownCandidate(baseNormalized)) {
        summary.nonTechnicalUnknown += 1;
        sourceBucket.nonTechnicalUnknown += 1;
        continue;
      }

      candidates.push({
        source: entry.name,
        fileIndex: files.length - 1,
        jobIndex: index,
        before: baseNormalized,
      });
    }

    sourceSummary.set(entry.name, sourceBucket);
  }

  const jobsToAudit = limit > 0 ? candidates.slice(0, limit) : candidates;
  summary.auditedCandidates = jobsToAudit.length;

  let browserSessionPromise = null;
  const getBrowserSession = async () => {
    if (!browserSessionPromise) {
      browserSessionPromise = createBrowserFetchSession({ userAgent: USER_AGENT });
    }

    return browserSessionPromise;
  };

  const results = new Array(jobsToAudit.length);
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= jobsToAudit.length) return;

      const candidate = jobsToAudit[currentIndex];
      const sourceBucket = sourceSummary.get(candidate.source) || createSourceBucket();
      sourceBucket.auditedCandidates += 1;
      sourceSummary.set(candidate.source, sourceBucket);

      let usedDefaultFetch = false;
      let usedBrowserFetch = false;
      let defaultFetchError = null;
      let browserFetchError = null;
      let afterInput = candidate.before;

      const jobUrl = resolvePublicJobUrl(candidate.before);
      if (jobUrl) {
        usedDefaultFetch = true;
        try {
          const defaultHtml = await defaultFetchText(jobUrl);
          afterInput = inferExperienceFromPublicPageHtml(candidate.before, defaultHtml);
        } catch (error) {
          defaultFetchError = serializeError(error);
        }
      }

      let after = normalizeScrapedJob(afterInput, {
        source: candidate.before.source || candidate.source,
      });

      if (shouldUseBrowserFallback({
        before: candidate.before,
        after,
        usedDefaultFetch,
        defaultFetchError,
      })) {
        usedBrowserFetch = true;
        try {
          const session = await getBrowserSession();
          const browserHtml = await session.fetchText(jobUrl);
          after = normalizeScrapedJob(
            inferExperienceFromPublicPageHtml(candidate.before, browserHtml),
            { source: candidate.before.source || candidate.source },
          );
        } catch (error) {
          browserFetchError = serializeError(error);
        }
      }
      const row = buildResultRow({
        source: candidate.source,
        before: candidate.before,
        after,
        usedDefaultFetch,
        usedBrowserFetch,
        defaultFetchError,
        browserFetchError,
      });

      const fileRecord = files[candidate.fileIndex];
      fileRecord.normalizedJobs[candidate.jobIndex] = after;

      if (JSON.stringify(fileRecord.originalJobs[candidate.jobIndex]) !== JSON.stringify(after)) {
        fileRecord.changed = true;
      }

      if (row.classification === "recovered") {
        summary.recovered += 1;
        sourceBucket.recovered += 1;
      } else if (row.classification === "confirmed_unknown") {
        summary.confirmedUnknown += 1;
        sourceBucket.confirmedUnknown += 1;
      } else {
        summary.unverified += 1;
        sourceBucket.unverified += 1;
      }

      if (row.experienceChanged) {
        summary.experienceRecovered += 1;
        sourceBucket.experienceRecovered += 1;
      }

      if (usedBrowserFetch) {
        summary.browserFallbackUsed += 1;
      }

      results[currentIndex] = row;
      completed += 1;

      if (completed % 25 === 0 || completed === jobsToAudit.length) {
        console.log(JSON.stringify({
          progress: {
            completed,
            total: jobsToAudit.length,
            recovered: summary.recovered,
            confirmedUnknown: summary.confirmedUnknown,
            unverified: summary.unverified,
            browserFallbackUsed: summary.browserFallbackUsed,
          },
        }));
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(jobsToAudit.length, 1)) }, () => worker()));

  if (shouldWrite) {
    for (const fileRecord of files) {
      if (!fileRecord.changed) continue;
      await fs.writeFile(fileRecord.jobsPath, `${JSON.stringify(fileRecord.normalizedJobs, null, 2)}\n`, "utf8");
      summary.changedFiles += 1;
    }
  }

  if (browserSessionPromise) {
    const session = await browserSessionPromise;
    await session.close().catch(() => {});
  }

  const sourceBreakdown = [...sourceSummary.entries()]
    .map(([source, bucket]) => ({ source, ...bucket }))
    .sort((left, right) => (
      right.recovered - left.recovered
      || right.auditedCandidates - left.auditedCandidates
      || left.source.localeCompare(right.source, "en")
    ));

  const output = {
    generatedAt: auditStartedAt.toISOString(),
    completedAt: new Date().toISOString(),
    options: {
      concurrency,
      timeoutMs,
      limit: limit || null,
      sourceFilter: selectedSources ? [...selectedSources] : null,
      browserMode,
      write: shouldWrite,
    },
    summary,
    sourceBreakdown,
    results,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    outputPath,
    summary,
    topRecoveredSources: sourceBreakdown.filter((row) => row.recovered > 0).slice(0, 12),
  }, null, 2));
}

main().catch((error) => {
  console.error("Engineering domain audit failed:", error);
  process.exitCode = 1;
});
