/**
 * @file Schema and indexes for job apply click tracking.
 * @module models/Click
 */

import { Schema, model } from "mongoose";

const ClickSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      immutable: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    ip: {
      type: String,
      immutable: true,
    },
    userAgent: {
      type: String,
      immutable: true,
    },
  },
  {
    strict: true,
  }
);

ClickSchema.index({ user: 1, clickedAt: 1 });
ClickSchema.index({ job: 1, clickedAt: 1 });
ClickSchema.index({ job: 1, user: 1, clickedAt: 1 });
ClickSchema.index({ job: 1, ip: 1, userAgent: 1, clickedAt: 1 });
ClickSchema.index({ clickedAt: -1 });

ClickSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const Click = model("Click", ClickSchema);

export default Click;
