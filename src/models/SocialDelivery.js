import { Schema, model } from 'mongoose';

const schema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: 'SocialPost', required: true, immutable: true },
  fingerprint: { type: String, required: true, immutable: true },
  platform: { type: String, enum: ['linkedin', 'instagram'], required: true, immutable: true },
  destination: { type: String, required: true, immutable: true }, accountRevision: Number,
  status: { type: String, enum: ['queued', 'processing', 'submitted', 'published', 'failed', 'uncertain', 'cancelled', 'missed', 'needs_review'], default: 'queued' },
  slot: Date, reserved: { type: Boolean, default: false },
  snapshot: { type: Schema.Types.Mixed, required: true },
  phase: { type: String, default: 'prepare' }, providerState: { type: Schema.Types.Mixed, default: () => ({}), select: false },
  providerId: String, permalink: String, publishedAt: Date, publishStartedAt: Date,
  batchId: String, batchDeadline: Date, startedAt: Date, nextPollAt: Date, attempts: { type: Number, default: 0 },
  leaseToken: { type: String, select: false }, leaseUntil: Date, reason: { type: String, default: '' },
}, { timestamps: true });
schema.index({ platform: 1, destination: 1, fingerprint: 1 }, { unique: true });
schema.index({ platform: 1, slot: 1 }, { unique: true, partialFilterExpression: { reserved: true } });
schema.index({ status: 1, slot: 1 });
schema.index({ batchId: 1, status: 1 });
export default model('SocialDelivery', schema);
