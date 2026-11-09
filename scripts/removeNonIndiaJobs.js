/**
 * removeNonIndiaJobs.js - Preview and purge jobs that fall outside the public India scope.
 *
 * Usage:
 *   node scripts/removeNonIndiaJobs.js
 *   node scripts/removeNonIndiaJobs.js --confirm
 *   node scripts/removeNonIndiaJobs.js --confirm --repair-cities
 *
 * By default this script only previews the rows that would be deleted.
 * Pass --confirm to actually delete them.
 * Pass --repair-cities to normalize the remaining city values using the same
 * India-only location scope shared by the public jobs API.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env") });

const shouldConfirm = process.argv.includes("--confirm");
const shouldRepairCities = process.argv.includes("--repair-cities");
const sampleSizeArg = process.argv.find((value) => value.startsWith("--sample="));
const sampleSize = Math.max(
  1,
  Math.min(50, Number.parseInt(sampleSizeArg?.split("=")[1] || "10", 10) || 10),
);

const { default: connectDB } = await import("../db/db.js");
const { default: Job } = await import("../src/models/Job.js");
const {
  getValidIndiaCityForJob,
  isJobInPublicLocationScope,
} = await import("../src/utils/publicJobLocationScope.js");

const incrementBucket = (map, key) => {
  const bucketKey = String(key || "unknown");
  map.set(bucketKey, (map.get(bucketKey) || 0) + 1);
};

const toSortedObject = (map) => Object.fromEntries(
  [...map.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
);

const chunk = (items, size = 500) => {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

async function main() {
  await connectDB();

  const projection = {
    title: 1,
    company: 1,
    city: 1,
    location: 1,
    locations: 1,
    country: 1,
    source: 1,
    status: 1,
  };

  const jobs = await Job.find({}, projection).lean().exec();

  const invalidJobs = [];
  const validCityRepairs = [];
  const invalidBySource = new Map();
  const invalidByStatus = new Map();

  for (const job of jobs) {
    if (!isJobInPublicLocationScope(job)) {
      invalidJobs.push(job);
      incrementBucket(invalidBySource, job.source);
      incrementBucket(invalidByStatus, job.status);
      continue;
    }

    const normalizedCity = getValidIndiaCityForJob(job);
    if (normalizedCity && normalizedCity !== (job.city || null)) {
      validCityRepairs.push({
        _id: job._id,
        company: job.company,
        title: job.title,
        previousCity: job.city || null,
        nextCity: normalizedCity,
      });
    }
  }

  const preview = {
    totalJobs: jobs.length,
    invalidJobs: invalidJobs.length,
    invalidByStatus: toSortedObject(invalidByStatus),
    invalidBySource: toSortedObject(invalidBySource),
    repairableCities: validCityRepairs.length,
    sampleInvalidJobs: invalidJobs.slice(0, sampleSize).map((job) => ({
      company: job.company,
      title: job.title,
      city: job.city || null,
      location: job.location || null,
      country: job.country || null,
      source: job.source || null,
      status: job.status || null,
    })),
    sampleCityRepairs: validCityRepairs.slice(0, sampleSize),
  };

  console.log(JSON.stringify(preview, null, 2));

  if (!shouldConfirm) {
    console.log("\nPreview only. Re-run with --confirm to delete invalid jobs.");
    if (validCityRepairs.length > 0) {
      console.log("Add --repair-cities to normalize the remaining city labels after deletion.");
    }
    return;
  }

  let deletedCount = 0;
  for (const group of chunk(invalidJobs.map((job) => job._id), 500)) {
    if (group.length === 0) continue;
    const result = await Job.deleteMany({ _id: { $in: group } });
    deletedCount += result.deletedCount || 0;
  }

  let repairedCount = 0;
  if (shouldRepairCities && validCityRepairs.length > 0) {
    for (const group of chunk(validCityRepairs, 500)) {
      const operations = group.map((job) => ({
        updateOne: {
          filter: { _id: job._id },
          update: { $set: { city: job.nextCity } },
        },
      }));

      const result = await Job.bulkWrite(operations, { ordered: false });
      repairedCount += result.modifiedCount || 0;
    }
  }

  const remainingJobs = await Job.countDocuments({});
  const remainingInvalidJobs = (
    await Job.find({}, projection).lean().exec()
  ).filter((job) => !isJobInPublicLocationScope(job)).length;

  console.log(
    JSON.stringify(
      {
        deletedCount,
        repairedCount,
        remainingJobs,
        remainingInvalidJobs,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error("Non-India job cleanup failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
