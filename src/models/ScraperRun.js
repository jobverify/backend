/**
 * @file Schema and indexes for scraper run history audit logging.
 * @module models/ScraperRun
 */

import { Schema, model } from "mongoose";
import { DEFAULT_JOB_RETENTION_DAYS } from "../utils/jobLifecycle.js";

const ScraperRunSourceSchema = new Schema(
  {
    success: {
      type: Boolean,
      required: true,
    },
    jobsFound: {
      type: Number,
      default: null,
    },
    eligibleJobsFound: {
      type: Number,
      default: null,
    },
    rawRecords: { type: Number, default: null },
    filteredNonIndia: { type: Number, default: null },
    filteredClosed: { type: Number, default: null },
    filteredInvalidUrl: { type: Number, default: null },
    filteredEmptyDescription: { type: Number, default: null },
    filteredNonJob: { type: Number, default: null },
    zeroJobEvidence: { type: String, default: null },
    inventoryEvidence: { type: Schema.Types.Mixed, default: null },
    inventoryDelegationEvidence: { type: Schema.Types.Mixed, default: null },
    sourceObservations: { type: Schema.Types.Mixed, default: null },
    retryPressure: { type: Schema.Types.Mixed, default: null },
    retry: { type: Schema.Types.Mixed, default: null },
    jobIdentityHashes: { type: [String], default: undefined },
    detailHealth: { type: Schema.Types.Mixed, default: null },
    attemptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    partial: { type: Boolean, default: null },
    processingComplete: { type: Boolean, default: null },
    skipped: { type: Boolean, default: null },
    softFailure: { type: Boolean, default: null },
    upstreamOutage: { type: Boolean, default: null },
    failureKind: { type: String, default: null },
    inserted: {
      type: Number,
      default: 0,
    },
    updated: {
      type: Number,
      default: 0,
    },
    deleted: {
      type: Number,
      default: 0,
    },
    filteredOld: {
      type: Number,
      default: null,
    },
    missed: {
      type: Number,
      default: 0,
    },
    expired: {
      type: Number,
      default: 0,
    },
    staleCheckSkipped: {
      type: Boolean,
      default: false,
    },
    staleCheckReason: {
      type: String,
      default: null,
    },
    staleCheckReasonCode: { type: String, default: null },
    retentionDays: {
      type: Number,
      default: DEFAULT_JOB_RETENTION_DAYS,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const ScraperRunSchema = new Schema(
  {
    ranAt: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true,
    },
    sources: {
      type: Map,
      of: ScraperRunSourceSchema,
      default: {},
    },
    overall: {
      taskOutcomes: { type: Schema.Types.Mixed, default: null },
      inventoryChecks: { type: Schema.Types.Mixed, default: null },
      extractionChecks: { type: Schema.Types.Mixed, default: null },
      jobYield: { type: Schema.Types.Mixed, default: null },
      health: { type: String, default: null },
      coverageComplete: { type: Boolean, default: null },
      partialSuccessfulTasks: { type: Number, default: null },
      failedTasks: { type: Number, default: null },
      totalJobs: {
        type: Number,
        required: true,
        default: 0,
      },
      sourcesSucceeded: {
        type: Number,
        required: true,
        default: 0,
      },
      sourcesFailed: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  },
  {
    strict: true,
  }
);

// Keep the audit trail bounded on Atlas free tiers. MongoDB's TTL monitor
// removes documents after this age without affecting active job listings.
ScraperRunSchema.index({ ranAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

ScraperRunSchema.set("toJSON", {
  // Transforms database document representation for API JSON responses.
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const ScraperRun = model("ScraperRun", ScraperRunSchema);

export default ScraperRun;
