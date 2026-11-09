import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Job from "../models/Job.js";
import JobDatasetSummary from "../models/JobDatasetSummary.js";
import { applyPublicJobLocationScope } from "../utils/publicJobLocationScope.js";
import { PUBLIC_JOB_TYPE_EXPRESSION } from "../utils/publicJobType.js";
import { PUBLIC_JOB_TYPES } from "../utils/publicJobTypeLabel.js";

export const JOB_DATASET_SUMMARY_KEY = "public-active";
export const JOB_DATASET_LIFECYCLE_VERSION = 8;
const NATIVE_SUMMARY_FIND_ONE = JobDatasetSummary.findOne;
const INITIAL_SUMMARY_ID = new mongoose.Types.ObjectId(
  createHash("sha256").update(JOB_DATASET_SUMMARY_KEY).digest("hex").slice(0, 24),
);

const asSortedUniqueStrings = (values = []) => [...new Set(
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean),
)].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));

const isPositiveSafeSequence = field => ({ $and: [
  { $in: [{ $type: field }, ["int", "long", "double"]] },
  { $gte: [field, 1] },
  { $lte: [field, Number.MAX_SAFE_INTEGER] },
  { $eq: [field, { $trunc: { $convert: { input: field, to: "double", onError: 0, onNull: 0 } } }] },
] });

const reserveSummaryRefresh = async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await readJobDatasetSummary();
    try {
      return await JobDatasetSummary.findOneAndUpdate(
        { _id: existing?._id ?? INITIAL_SUMMARY_ID, key: JOB_DATASET_SUMMARY_KEY },
        { $inc: { refreshSequence: 1 }, $setOnInsert: { key: JOB_DATASET_SUMMARY_KEY } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean().exec();
    } catch (error) {
      // Initial concurrent upserts share MongoDB's unique _id. A legacy unique
      // key index can also select an existing anchor on the following attempt.
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
};

export const refreshJobDatasetSummary = async () => {
  const reservation = await reserveSummaryRefresh();
  const observedAt = new Date();
  const { $expr: lifecycleScope, ...baseScope } = applyPublicJobLocationScope({ status: "active" }, observedAt);
  const [result] = await Job.aggregate([
    { $match: baseScope },
    {
      $facet: {
        visible: [
          { $match: { $expr: { $and: [lifecycleScope, { $in: [PUBLIC_JOB_TYPE_EXPRESSION, PUBLIC_JOB_TYPES] }] } } },
          { $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            companies: { $addToSet: "$company" },
            cities: { $addToSet: "$city" },
            jobTypes: { $addToSet: PUBLIC_JOB_TYPE_EXPRESSION },
            nextClosingAt: { $min: "$closingDate" },
          } },
        ],
        futurePublications: [
          { $match: {
            postedAt: { $gt: observedAt },
            $expr: { $or: [
              { $eq: [{ $ifNull: ["$closingDate", null] }, null] },
              { $gt: ["$closingDate", "$postedAt"] },
            ] },
          } },
          { $group: { _id: null, nextPublicationAt: { $min: "$postedAt" } } },
        ],
      },
    },
  ]).exec();
  const aggregate = result?.visible?.[0];

  const companies = asSortedUniqueStrings(aggregate?.companies);
  const cities = asSortedUniqueStrings(aggregate?.cities);
  const jobTypes = asSortedUniqueStrings(aggregate?.jobTypes);
  const summary = {
    key: JOB_DATASET_SUMMARY_KEY,
    lifecycleVersion: JOB_DATASET_LIFECYCLE_VERSION,
    publishedSequence: reservation.refreshSequence,
    totalJobs: Number(aggregate?.totalJobs ?? 0),
    totalCompanies: companies.length,
    companies,
    cities,
    jobTypes,
    refreshedAt: observedAt,
    nextClosingAt: aggregate?.nextClosingAt ?? null,
    nextPublicationAt: result?.futurePublications?.[0]?.nextPublicationAt ?? null,
  };

  // A database-issued sequence also orders queries that start in the same
  // millisecond. A late writer returns the winner instead of regressing it.
  const publishedAt = new Date();
  const preserveNewer = { $and: [
    { $eq: ["$lifecycleVersion", JOB_DATASET_LIFECYCLE_VERSION] },
    { $eq: [{ $type: "$refreshedAt" }, "date"] },
    { $lte: ["$refreshedAt", publishedAt] },
    isPositiveSafeSequence("$publishedSequence"),
    isPositiveSafeSequence("$refreshSequence"),
    { $lte: ["$publishedSequence", "$refreshSequence"] },
    { $gt: ["$publishedSequence", reservation.refreshSequence] },
  ] };
  const document = await JobDatasetSummary.findOneAndUpdate(
    { _id: reservation._id, key: JOB_DATASET_SUMMARY_KEY },
    [{ $set: Object.fromEntries(Object.entries(summary).map(([key, value]) => [
      key, { $cond: [preserveNewer, `$${key}`, { $literal: value }] },
    ])) }],
    {
      upsert: false,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .lean()
    .exec();

  return document ?? summary;
};

export const readJobDatasetSummary = async () => (
  mongoose.connection.readyState !== 1 && JobDatasetSummary.findOne === NATIVE_SUMMARY_FIND_ONE
    ? null
    : JobDatasetSummary.findOne({ key: JOB_DATASET_SUMMARY_KEY })
      .sort({ _id: 1 })
      .lean()
      .exec()
);
