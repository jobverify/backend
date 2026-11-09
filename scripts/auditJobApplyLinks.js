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
} from "./lib/jobLinkAudit.js";

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
  return path.join(workspaceArtifactsDir, `apply-link-audit-${timestamp}.json`);
};

const projection = {
  title: 1,
  company: 1,
  source: 1,
  applyUrl: 1,
  sourceUrl: 1,
  atsPlatform: 1,
};

async function main() {
  const auditNow = new Date();
  const concurrency = toInt(findArgValue("--concurrency"), DEFAULT_CONCURRENCY);
  const timeoutMs = toInt(findArgValue("--timeout-ms"), DEFAULT_TIMEOUT_MS);
  const limit = toInt(findArgValue("--limit"), 0);
  const expectedCount = toInt(findArgValue("--expected-count"), 0) || null;
  const outputPath = path.resolve(findArgValue("--output") || buildDefaultOutputPath());
  const allowCountMismatch = process.argv.includes("--allow-count-mismatch");
  const datasetConfig = buildAuditDatasetConfig({
    scope: findArgValue("--scope"),
    now: auditNow,
  });

  await connectDB();

  const [summaryDocument, scopedJobCount, activeJobs] = await Promise.all([
    datasetConfig.scope === "public"
      ? JobDatasetSummary.findOne({ key: JOB_DATASET_SUMMARY_KEY }).lean().exec()
      : Promise.resolve(null),
    Job.countDocuments(datasetConfig.query),
    Job.find(datasetConfig.query, projection).lean().exec(),
  ]);
  const baselineJobCount = datasetConfig.scope === "public"
    ? summaryDocument?.totalJobs ?? null
    : scopedJobCount;

  const jobs = limit > 0 ? activeJobs.slice(0, limit) : activeJobs;
  const report = await auditJobLinks({
    jobs,
    summaryTotalJobs: baselineJobCount,
    expectedTotalJobs: expectedCount,
    baselineLabel: datasetConfig.baselineLabel,
    snapshotLabel: datasetConfig.snapshotLabel,
    fetchImpl: fetch,
    allowCountMismatch,
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
      limit: limit || null,
      expectedCount,
      allowCountMismatch,
    },
    dataset: {
      scope: datasetConfig.scope,
      label: datasetConfig.label,
      baselineJobCount,
      scopedJobCount,
      auditedJobCount: jobs.length,
      summaryRefreshedAt: summaryDocument?.refreshedAt ?? null,
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
  console.error("Apply link audit failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
