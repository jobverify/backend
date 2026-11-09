/**
 * @file Schema and indexes for administrative audit logging.
 * @module models/AdminAudit
 */

import { Schema, model } from "mongoose";

const AdminAuditSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    targetType: {
      type: String,
      enum: ["Job", "User", "ScraperStatus", "TelegramBroadcastSettings"],
      required: true,
      immutable: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      refPath: "targetType",
      default: null,
      immutable: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    details: {
      type: String,
      immutable: true,
    },
  },
  {
    strict: true,
  }
);

AdminAuditSchema.index({ admin: 1, timestamp: 1 });
AdminAuditSchema.index({ targetId: 1, targetType: 1 });
AdminAuditSchema.index({ timestamp: -1 });
AdminAuditSchema.index({ action: 1, timestamp: -1 });

AdminAuditSchema.set("toJSON", {
  // Transforms database document representation for API JSON responses.
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const AdminAudit = model("AdminAudit", AdminAuditSchema);

export default AdminAudit;
