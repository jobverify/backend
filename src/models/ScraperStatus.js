/**
 * @file Schema and indexes for live scraper status dashboard.
 * @module models/ScraperStatus
 */

import { Schema, model } from "mongoose";
import { DEFAULT_JOB_RETENTION_DAYS } from "../utils/jobLifecycle.js";

const ScraperStatusSchema = new Schema(
  {
    source: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    // Retain the in-flight batch for retry if cleanup fails after job deletion.
    purgeJobIds: { type: [Schema.Types.ObjectId], default: undefined, select: false },
    lastRanAt: {
      type: Date,
      required: true,
    },
    lastSuccess: {
      type: Boolean,
      required: true,
    },
    // Latest attempt is independent of legacy last-success counts.
    latestAttempt: { type: Schema.Types.Mixed, default: null },
    lastCompleteCheckAt: { type: Date, default: null },
    consecutiveFailures: {
      type: Number,
      required: true,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    softFailure: {
      type: Boolean,
      default: false,
    },
    upstreamOutage: {
      type: Boolean,
      default: false,
    },
    failureKind: {
      type: String,
      default: null,
    },
    lastJobsFound: {
      type: Number,
      default: 0,
    },
    lastEligibleJobsFound: {
      type: Number,
      default: 0,
    },
    lastCompleteJobsFound: {
      type: Number,
      default: null,
    },
    lastCompleteEligibleJobsFound: {
      type: Number,
      default: null,
    },
    lastInserted: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Number,
      default: 0,
    },
    lastDeleted: {
      type: Number,
      default: 0,
    },
    lastFilteredOld: {
      type: Number,
      default: 0,
    },
    lastExpired: {
      type: Number,
      default: 0,
    },
    lastMissed: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    lastPartialAt: {
      type: Date,
      default: null,
    },
    lastPartialReason: {
      type: String,
      default: null,
    },
    lastRetentionDays: {
      type: Number,
      default: DEFAULT_JOB_RETENTION_DAYS,
    },
    pipelineState: {
      type: String,
      enum: ["idle", "running", "error"],
      default: null,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    lastCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    strict: true,
  }
);

ScraperStatusSchema.index({ consecutiveFailures: 1 });

ScraperStatusSchema.set("toJSON", {
  // Transforms database document representation for API JSON responses.
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const ScraperStatus = model("ScraperStatus", ScraperStatusSchema);

export default ScraperStatus;
