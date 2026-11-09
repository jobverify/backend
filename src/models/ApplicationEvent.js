import { Schema, model } from 'mongoose';
import { APPLICATION_STAGES } from './Application.js';

const applicationEventSchema = new Schema({
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, immutable: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  key: { type: String, required: true, maxlength: 340, immutable: true },
  kind: { type: String, enum: ['opened', 'submission_confirmed', 'stage_changed', 'tracking_started'], required: true, immutable: true },
  actor: { type: String, enum: ['candidate', 'system'], required: true, immutable: true },
  actorUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  source: { type: String, enum: ['employer_link', 'self_reported', 'email', 'auto_apply', 'candidate'], required: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  recordedAt: { type: Date, default: Date.now, required: true, immutable: true },
  priorStage: { type: String, enum: ['', ...APPLICATION_STAGES], default: '', immutable: true },
  newStage: { type: String, enum: APPLICATION_STAGES, required: true, immutable: true },
  version: { type: Number, required: true, min: 0, immutable: true },
  expectedVersion: { type: Number, default: null, immutable: true },
  note: { type: String, maxlength: 2000, default: '', immutable: true },
  reference: { type: String, maxlength: 300, default: '', immutable: true },
}, { versionKey: false });

applicationEventSchema.index({ application: 1, key: 1 }, { unique: true });
applicationEventSchema.index({ user: 1, application: 1, occurredAt: -1, _id: -1 });
applicationEventSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], function rejectRewrite() {
  throw new Error('Application events are append-only.');
});
applicationEventSchema.pre('save', function rejectResave() {
  if (!this.isNew) throw new Error('Application events are append-only.');
});

export default model('ApplicationEvent', applicationEventSchema);
