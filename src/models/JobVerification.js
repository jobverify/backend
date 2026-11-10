import { Schema, model } from 'mongoose';

const schema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  activeOwner: { type: String },
  input: { url: { type: String, required: true }, company: String, title: String },
  status: { type: String, enum: ['admitting', 'queued', 'running', 'completed', 'failed'], default: 'queued', required: true },
  phase: { type: String, default: 'queued' },
  report: { type: Schema.Types.Mixed, default: () => ({}) },
  runToken: String,
  leaseUntil: Date,
  startedAt: Date,
  completedAt: Date,
  expiresAt: { type: Date, required: true },
  error: String,
}, { timestamps: true });
schema.index({ activeOwner: 1 }, { unique: true, sparse: true });
schema.index({ owner: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, createdAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default model('JobVerification', schema);
