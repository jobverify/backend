/**
 * @file Schema and TTL index for pending users awaiting email verification.
 * @module models/PendingUser
 */

import { Schema, model } from "mongoose";

const PendingUserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, default: null },
    pendingBrowserNonceHash: { type: String, default: null },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profile: {
      name: { type: String, required: true },
    },
    verificationToken: { type: String, default: null },
    verificationTokenHash: { type: String, required: true },
    verificationTokenExpiresAt: { type: Date, required: true },
    resendCount: {
      type: Number,
      default: 0, // counts number of resend requests (excludes initial register email)
    },
    resendWindowStartedAt: {
      type: Date,
      default: null,
    },
    lastResentAt: {
      type: Date,
      default: Date.now, // initialized to register time
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours in seconds for automatic MongoDB TTL cleanup
    },
  },
  {
    strict: true,
  }
);

PendingUserSchema.index({ verificationTokenHash: 1 });

// Formats document to ignore internal properties in JSON conversion.
PendingUserSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.pendingBrowserNonceHash;
    delete ret.verificationToken;
    delete ret.verificationTokenHash;
    delete ret.verificationTokenExpiresAt;
    delete ret.__v;
    return ret;
  },
});

const PendingUser = model("PendingUser", PendingUserSchema);

export default PendingUser;
