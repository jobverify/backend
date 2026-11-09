import { Schema, model } from 'mongoose';

// Revisions are append-only. Artifacts are shared by restores, never replaced.
const schema = new Schema({
  _id: { type: String, required: true, immutable: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  kind: { type: String, enum: ['base', 'tailored'], required: true, immutable: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', immutable: true },
  sequence: { type: Number, required: true, min: 1, immutable: true },
  generationId: { type: String, immutable: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  reason: { type: String, enum: ['generated', 'restored', 'legacy_import'], required: true, immutable: true },
  restoredFrom: { type: String, immutable: true },
  sourceSnapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
  evidenceSnapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
  outputSnapshot: { type: Schema.Types.Mixed, immutable: true },
  pageCount: { type: Number, immutable: true },
  modelVersion: { type: String, immutable: true },
  styleVersion: { type: String, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
schema.index({ user: 1, kind: 1, job: 1, sequence: -1 }, { unique: true });
export default model('CVRevision', schema);
