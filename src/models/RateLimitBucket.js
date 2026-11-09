import { Schema, model } from 'mongoose';

// Only the API server can access this collection. No raw client IPs or secrets.
const schema = new Schema({
  _id: { type: String, required: true },
  count: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false, bufferCommands: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('RateLimitBucket', schema);
