import mongoose from "mongoose";

import connectDB from "../db/db.js";
import Job from "../src/models/Job.js";
import { resolveJobType } from "../scraper-support/utils/normalizeScrapedJob.js";
import { PUBLIC_JOB_TYPES, normalizePublicJobType } from '../src/utils/publicJobTypeLabel.js';

const shouldApply = process.argv.includes("--apply");
const canonicalJobTypes = PUBLIC_JOB_TYPES;
const cursor = Job.find({ status: "active", jobType: { $nin: canonicalJobTypes } })
  .select("employmentType experienceLevel title department sourceDescription description jobDescription minimumQualification preferredQualification experienceRequired jobType")
  .lean()
  .cursor();

let scanned = 0;
let changed = 0;
let operations = [];

const flush = async () => {
  if (operations.length === 0 || !shouldApply) return;
  await Job.bulkWrite(operations, { ordered: false });
  operations = [];
};

try {
  await connectDB();

  for await (const job of cursor) {
    scanned += 1;
    const sourceEmploymentType = job.employmentType || job.jobType;
    const jobType = normalizePublicJobType(resolveJobType({ ...job, employmentType: sourceEmploymentType }));
    if (!jobType || jobType === job.jobType) continue;

    changed += 1;
    operations.push({
      updateOne: {
        filter: { _id: job._id, jobType: job.jobType },
        update: { $set: { jobType } },
      },
    });

    if (operations.length >= 500) await flush();
  }

  await flush();
  console.log(JSON.stringify({ mode: shouldApply ? "applied" : "dry-run", scanned, changed }));
} finally {
  await mongoose.disconnect();
}
