/**
 * @file Schema for one-time Telegram account-linking tokens.
 * @module models/TelegramLinkToken
 */

import { Schema, model } from "mongoose";

const TelegramLinkTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

TelegramLinkTokenSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { consumedAt: null },
    name: "unique_active_telegram_link_per_user",
  },
);

const TelegramLinkToken = model("TelegramLinkToken", TelegramLinkTokenSchema);

export default TelegramLinkToken;
