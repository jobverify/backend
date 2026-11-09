import mongoose from "mongoose";
import dotenv from "dotenv";

import connectDB from "../db/db.js";
import Job from "../src/models/Job.js";
import { buildJobDerivedFields } from "../src/utils/jobDerivedFields.js";
import { resolveJobPostedAt } from "../src/utils/jobLifecycle.js";

dotenv.config();

const parseIntegerFlag = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const dryRun = process.argv.includes("--dry-run");
const batchSize = parseIntegerFlag("batch-size", 500);

const main = async () => {
  const summary = {
    dryRun,
    batchSize,
    scanned: 0,
    updated: 0,
    skippedWithoutFallback: 0,
  };
  let cursor = null;

  await connectDB();

  try {
    while (true) {
      const query = {
        postedAt: null,
        ...(cursor ? { _id: { $gt: cursor } } : {}),
      };
      const jobs = await Job.find(query)
        .select("_id postedAt scrapedAt scrapedTimestamp sortDate createdAt city location locations")
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean()
        .exec();

      if (jobs.length === 0) break;

      const operations = [];

      for (const job of jobs) {
        summary.scanned += 1;

        const postedAt = resolveJobPostedAt(job);
        if (!postedAt) {
          summary.skippedWithoutFallback += 1;
          continue;
        }

        const derivedFields = buildJobDerivedFields({
          ...job,
          postedAt,
        });

        summary.updated += 1;
        operations.push({
          updateOne: {
            filter: { _id: job._id },
            update: {
              $set: {
                postedAt,
                sortDate: derivedFields.sortDate,
                isPublicIndia: derivedFields.isPublicIndia,
                publicCityKey: derivedFields.publicCityKey,
              },
            },
          },
        });
      }

      if (!dryRun && operations.length > 0) {
        await Job.bulkWrite(operations, { ordered: false });
      }

      cursor = jobs.at(-1)._id;
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Job postedAt backfill failed:", error);
  process.exitCode = 1;
});
