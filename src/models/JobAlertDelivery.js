/**
 * @file Schema for deduplicated job alert deliveries.
 * @module models/JobAlertDelivery
 */

import { Schema, model } from "mongoose";

const JobAlertDeliverySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    channel: {
      type: String,
      enum: ["telegram"],
      default: "telegram",
    },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    scheduledFor: { type: Date, default: null },
    schedulePaused: { type: Boolean, default: false },
    scheduleVersion: { type: Number, default: 0 },
    retryAt: { type: Date, default: null },
    claimToken: {
      type: String,
      default: null,
    },
    claimExpiresAt: {
      type: Date,
      default: null,
    },
    providerName: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    payloadPreview: {
      type: String,
      default: null,
    },
    jobSnapshot: {
      title: { type: String, default: null },
      company: { type: String, default: null },
      location: { type: String, default: null },
      jobUrl: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

JobAlertDeliverySchema.index(
  { user: 1, job: 1, channel: 1 },
  { unique: true },
);
JobAlertDeliverySchema.index(
  { channel: 1, status: 1, createdAt: 1 },
);
JobAlertDeliverySchema.index({ status: 1, schedulePaused: 1, scheduledFor: 1 });
JobAlertDeliverySchema.index({ channel: 1, status: 1, retryAt: 1 });
JobAlertDeliverySchema.index(
  { channel: 1, status: 1, claimExpiresAt: 1, createdAt: 1 },
);

JobAlertDeliverySchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const JobAlertDelivery = model("JobAlertDelivery", JobAlertDeliverySchema);

export default JobAlertDelivery;
