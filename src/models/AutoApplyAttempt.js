import { Schema, model } from 'mongoose';
const schema = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
  sessionVersion: { type: Number, required: true },
  status: { type: String, required: true, enum: ['queued_inspection', 'inspecting', 'review', 'queued_submission', 'submitting', 'applied', 'blocked', 'unconfirmed', 'cancelled'] },
  provider: { type: String, enum: ['lever', 'greenhouse'], required: true },
  url: { type: String, required: true },
  company: { type: String, required: true },
  title: { type: String, required: true },
  generationId: { type: String, required: true },
  pdfSha: { type: String, required: true },
  jobHash: { type: String, required: true },
  reviewToken: { type: String, required: true },
  manifest: { type: Schema.Types.Mixed, default: null },
  formHash: { type: String, default: '' },
  answers: { type: Schema.Types.Mixed, default: {} },
  approvedAt: { type: Date, default: null },
  submitStartedAt: { type: Date, default: null },
  confirmation: { type: String, default: '', maxlength: 500 },
  error: { type: String, default: '', maxlength: 500 },
  leaseToken: { type: String, default: '', select: false },
  leaseUntil: { type: Date, default: () => new Date(0) },
}, { timestamps: true });
schema.index({ user: 1, job: 1 }, { unique: true });
schema.index({ status: 1, leaseUntil: 1, createdAt: 1 });
export default model('AutoApplyAttempt', schema);
