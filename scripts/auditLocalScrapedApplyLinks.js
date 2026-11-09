import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditJobLinks,
  getDeadJobCandidatesFromReport,
} from "./lib/jobLinkAudit.js";
import { buildLocalScrapedJobAuditSnapshot } from "./lib/localScrapedJobSnapshot.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceArtifactsDir = path.resolve(currentDir, "../../artifacts/job-link-audits");
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TIMEOUT_MS = 10000;

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
  return path.join(workspaceArtifactsDir, `local-scrape-apply-link-audit-${timestamp}.json`);
};

async function main() {
  const auditNow = new Date();
  const concurrency = toInt(findArgValue("--concurrency"), DEFAULT_CONCURRENCY);
  const timeoutMs = toInt(findArgValue("--timeout-ms"), DEFAULT_TIMEOUT_MS);
  const limit = toInt(findArgValue("--limit"), 0);
  const outputPath = path.resolve(findArgValue("--output") || buildDefaultOutputPath());
  const allowCountMismatch = process.argv.includes("--allow-count-mismatch");

  const snapshot = await buildLocalScrapedJobAuditSnapshot({ now: auditNow });
  const jobs = limit > 0 ? snapshot.jobs.slice(0, limit) : snapshot.jobs;
  const report = await auditJobLinks({
    jobs,
    summaryTotalJobs: snapshot.jobs.length,
    baselineLabel: "local filtered scrape count",
    snapshotLabel: "materialized local scrape snapshot",
    fetchImpl: fetch,
    allowCountMismatch,
    concurrency,
    timeoutMs,
    now: auditNow,
  });

  const output = {
    ...report,
    options: {
      source: "local-scraper-files",
      concurrency,
      timeoutMs,
      limit: limit || null,
      allowCountMismatch,
    },
    dataset: {
      source: "local-scraper-files",
      baselineJobCount: snapshot.jobs.length,
      auditedJobCount: jobs.length,
      snapshotStats: snapshot.counts,
      snapshotGeneratedAt: snapshot.generatedAt,
      postedAtCutoff: snapshot.postedAtCutoff,
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    outputPath,
    datasetStability: output.datasetStability,
    summary: output.summary,
    deadCandidates: getDeadJobCandidatesFromReport(output).length,
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("Local scraped apply-link audit failed:", error);
  process.exitCode = 1;
}
