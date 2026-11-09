import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

import "../loadEnv.js";
import connectDB from "../db/db.js";
import Job from "../src/models/Job.js";
import { getDeadJobCandidatesFromReport } from "./lib/jobLinkAudit.js";

const DEFAULT_SAMPLE_SIZE = 10;

const chunk = (items, size = 500) => {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

const findArgValue = (name) => {
  const prefix = `${name}=`;
  const direct = process.argv.find((value) => value.startsWith(prefix));
  return direct ? direct.slice(prefix.length) : null;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

async function main() {
  const reportArg = findArgValue("--report") || process.argv[2];
  if (!reportArg) {
    throw new Error("Pass --report=/absolute/or/relative/path/to/audit-report.json");
  }

  const reportPath = path.resolve(reportArg);
  const shouldConfirm = process.argv.includes("--confirm");
  const sampleSize = toInt(findArgValue("--sample"), DEFAULT_SAMPLE_SIZE);

  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const candidates = getDeadJobCandidatesFromReport(report);

  const preview = {
    reportPath,
    totalReportRows: Array.isArray(report?.results) ? report.results.length : 0,
    deadCandidates: candidates.length,
    idBackedCandidates: candidates.filter((candidate) => candidate.jobId).length,
    fingerprintBackedCandidates: candidates.filter((candidate) => candidate.fingerprint).length,
    sampleDeadCandidates: candidates.slice(0, sampleSize),
  };

  console.log(JSON.stringify(preview, null, 2));

  if (!shouldConfirm) {
    console.log("\nPreview only. Re-run with --confirm to delete dead jobs from MongoDB.");
    return;
  }

  await connectDB();

  let deletedCount = 0;
  const candidateIds = candidates.map((candidate) => candidate.jobId).filter(Boolean);
  const candidateFingerprints = candidates.map((candidate) => candidate.fingerprint).filter(Boolean);

  for (const group of chunk(candidateIds, 500)) {
    if (group.length === 0) continue;
    const result = await Job.deleteMany({ _id: { $in: group } }).exec();
    deletedCount += result.deletedCount || 0;
  }

  for (const group of chunk(candidateFingerprints, 500)) {
    if (group.length === 0) continue;
    const result = await Job.deleteMany({
      fingerprint: { $in: group },
      ...(candidateIds.length > 0 ? { _id: { $nin: candidateIds } } : {}),
    }).exec();
    deletedCount += result.deletedCount || 0;
  }

  console.log(JSON.stringify({
    reportPath,
    deadCandidates: candidates.length,
    idBackedCandidates: candidateIds.length,
    fingerprintBackedCandidates: candidateFingerprints.length,
    deletedCount,
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("Dead-job cleanup failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
