import mongoose from "mongoose";
import dotenv from "dotenv";

import connectDB from "../db/db.js";
import Job from "../src/models/Job.js";
import { extractJobFilterSignals } from "../src/utils/jobFilterSignals.js";
import { buildJobSearchKeys } from "../src/utils/jobSearchKeys.js";
import { buildJobDerivedFields } from "../src/utils/jobDerivedFields.js";
import { inferMissingExperienceRequired } from "../scraper-support/utils/normalizeScrapedJob.js";

dotenv.config();

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

const dryRun = process.argv.includes("--dry-run");
const batchSize = parseIntegerFlag("batch-size", 200);
const limit = parseIntegerFlag("limit", 0);
const startAfter = parseStringFlag("start-after");

const incrementMap = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
};

const topEntries = (map, count = 10) => [...map.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, count)
  .map(([value, total]) => ({ value, total }));

const hasMeaningfulSignals = (signals) => (
  signals.skillIds.length > 0
  || signals.requiredSkillIds.length > 0
  || signals.preferredSkillIds.length > 0
  || signals.experienceYears.length > 0
  || signals.experienceBucket !== "unspecified"
  || signals.primaryRoleDomain !== "Other"
  || signals.seniority !== "Unknown"
  || signals.workArrangement !== "Not specified"
);

const hasPartialSignals = (signals) => (
  signals.skillIds.length > 0
  || signals.experienceYears.length > 0
  || signals.experienceBucket !== "unspecified"
  || signals.primaryRoleDomain !== "Other"
  || signals.seniority !== "Unknown"
  || signals.workArrangement !== "Not specified"
);

const main = async () => {
  const summary = {
    dryRun,
    batchSize,
    processed: 0,
    enrichedSuccessfully: 0,
    partiallyEnriched: 0,
    noExtractableMetadata: 0,
    failed: 0,
    averageProcessingTimeMs: 0,
    topSkills: [],
    topRoleDomains: [],
    experienceBucketDistribution: [],
    experienceYearDistribution: [],
  };

  const skillCounts = new Map();
  const roleDomainCounts = new Map();
  const experienceBucketCounts = new Map();
  const experienceYearCounts = new Map();
  const startedAt = Date.now();
  let cursor = startAfter ? new mongoose.Types.ObjectId(startAfter) : null;
  let processedLimitReached = false;

  await connectDB();

  try {
    while (!processedLimitReached) {
      const query = cursor ? { _id: { $gt: cursor } } : {};
      const jobs = await Job.find(query)
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean()
        .exec();

      if (jobs.length === 0) {
        break;
      }

      const operations = [];

      for (const job of jobs) {
        try {
          const signals = extractJobFilterSignals(job);

          summary.processed += 1;
          if (hasMeaningfulSignals(signals)) {
            summary.enrichedSuccessfully += 1;
          } else if (hasPartialSignals(signals)) {
            summary.partiallyEnriched += 1;
          } else {
            summary.noExtractableMetadata += 1;
          }

          for (const skillId of signals.skillIds) {
            incrementMap(skillCounts, skillId);
          }
          incrementMap(roleDomainCounts, signals.primaryRoleDomain);
          incrementMap(experienceBucketCounts, signals.experienceBucket);
          for (const year of signals.experienceYears) {
            incrementMap(experienceYearCounts, String(year));
          }

          operations.push({
            updateOne: {
              filter: { _id: job._id },
              update: {
                $set: {
                  ...buildJobSearchKeys(job),
                  ...buildJobDerivedFields(job),
                  skillIds: signals.skillIds,
                  requiredSkillIds: signals.requiredSkillIds,
                  preferredSkillIds: signals.preferredSkillIds,
                  jobSkills: signals.jobSkills,
                  experienceBucket: signals.experienceBucket,
                  experienceRequired: inferMissingExperienceRequired(
                    job.experienceRequired,
                    signals.experienceProfile,
                  ),
                  experienceProfile: signals.experienceProfile,
                  experienceYears: signals.experienceYears,
                  seniority: signals.seniority,
                  primaryRoleDomain: signals.primaryRoleDomain,
                  secondaryRoleDomains: signals.secondaryRoleDomains,
                  workArrangement: signals.workArrangement,
                  filterSignals: signals.filterSignals,
                  taxonomyVersion: signals.taxonomyVersion,
                  extractionVersion: signals.extractionVersion,
                  extractedAt: signals.extractedAt,
                },
              },
            },
          });

          if (limit > 0 && summary.processed >= limit) {
            processedLimitReached = true;
            break;
          }
        } catch (error) {
          summary.failed += 1;
          console.error(`Failed to enrich job ${job._id}:`, error.message);
        }
      }

      if (!dryRun && operations.length > 0) {
        await Job.bulkWrite(operations, { ordered: false });
      }

      cursor = jobs.at(-1)._id;
    }

    const elapsedMs = Date.now() - startedAt;
    summary.averageProcessingTimeMs = summary.processed > 0
      ? Number((elapsedMs / summary.processed).toFixed(2))
      : 0;
    summary.topSkills = topEntries(skillCounts);
    summary.topRoleDomains = topEntries(roleDomainCounts);
    summary.experienceBucketDistribution = topEntries(experienceBucketCounts);
    summary.experienceYearDistribution = topEntries(experienceYearCounts);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
