import { Schema, model } from 'mongoose';
const schema = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], required: true },
  revision: { type: Number, default: 0 }, ready: { type: Boolean, default: false },
  currentRevisionId: String, historyVersion: { type: Number, default: 0 },
  sourceEvidenceVersion: Number, sourceEvidenceHash: String, outputEvidenceVersion: Number, outputEvidenceHash: String,
  sourceResumeSha: { type: String, required: true }, sourceJobHash: { type: String, required: true },
  phase: { type: String, default: '' }, sourceBaseGenerationId: String,
  generationId: String, outputBaseGenerationId: String, pageCount: Number,
  outputFormat: { type: String, enum: ['latex-pdf', 'legacy-json'] }, modelVersion: String, styleVersion: String,
  output: { type: Schema.Types.Mixed, default: null }, outputResumeSha: String, outputJobHash: String,
  error: { type: String, maxlength: 1000, default: '' }, attempts: { type: Number, default: 0 },
  leaseOwner: { type: String, select: false }, leaseUntil: Date, dispatchAt: Date, generatedAt: Date, requestedAt: Date,
}, { timestamps: true });
// Deterministic primary key also protects concurrent first requests before indexes exist.
schema.index({ user: 1, job: 1 }, { unique: true });
schema.index({ status: 1, ready: 1, createdAt: 1 });
export default model('TailoredResume', schema);
