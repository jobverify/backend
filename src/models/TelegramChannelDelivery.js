import { Schema, model } from 'mongoose';

const schema = new Schema({
  channel: { type: String, required: true, immutable: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  destination: { type: String, enum: ['channel', 'group'] },
  configRevision: { type: Number },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'skipped', 'uncertain'], default: 'queued' },
  retryAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  providerMessageId: { type: String, default: null },
  reason: { type: String, default: null },
}, { timestamps: true });

// Retain sent receipts: publication replay and process restarts cannot repost a job.
schema.index({ channel: 1, job: 1 }, { unique: true });
schema.index({ channel: 1, status: 1, createdAt: 1 });
export default model('TelegramChannelDelivery', schema);
