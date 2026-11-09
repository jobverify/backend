/**
 * @file Schema and indexes for blacklisted/revoked authentication tokens.
 * @module models/BlacklistedToken
 */

import { Schema, model } from "mongoose";

const BlacklistedTokenSchema = new Schema({
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

BlacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const BlacklistedToken = model("BlacklistedToken", BlacklistedTokenSchema);

export default BlacklistedToken;
