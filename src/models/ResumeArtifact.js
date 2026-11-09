import { Schema, model } from 'mongoose';

export const MAX_LATEX_BYTES = 256 * 1024;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const bytes = value => value?.length ?? value?.buffer?.length ?? 0;
const schema = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  kind: { type: String, enum: ['base', 'tailored'], required: true, immutable: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', immutable: true },
  sourceResumeSha: { type: String, required: true, immutable: true },
  sourceJobHash: { type: String, immutable: true }, sourceBaseGenerationId: { type: String, immutable: true },
  latex: { type: Buffer, required: true, select: false, immutable: true, validate: value => bytes(value) > 0 && bytes(value) <= MAX_LATEX_BYTES },
  pdf: { type: Buffer, required: true, select: false, immutable: true, validate: value => bytes(value) > 0 && bytes(value) <= MAX_PDF_BYTES },
  facts: { type: Schema.Types.Mixed, select: false, immutable: true },
  pageCount: { type: Number, required: true, min: 1, max: 100, immutable: true },
  modelVersion: { type: String, maxlength: 300, immutable: true }, styleVersion: { type: String, maxlength: 100, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
schema.index({ user: 1, kind: 1, job: 1 });
schema.set('toJSON', { transform(_doc, value) { delete value.latex; delete value.pdf; delete value.facts; return value; } });
export default model('ResumeArtifact', schema);
