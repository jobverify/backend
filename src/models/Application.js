import { Schema, model } from 'mongoose';

export const APPLICATION_STAGES = ['preparing', 'applied', 'screening', 'responded', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'expired'];

// History is independent of the live job inventory. Keep a small snapshot when
// listings expire or a source is removed, rather than losing the user's record.
const applicationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  jobSnapshot: {
    title: { type: String, required: true, maxlength: 1000 },
    company: { type: String, required: true, maxlength: 500 },
    location: { type: String, maxlength: 2000, default: '' },
    jobType: { type: String, maxlength: 100, default: '' },
    applicationUrl: { type: String, maxlength: 8192, default: '' },
  },
  status: { type: String, enum: ['opened', 'applied'], default: 'opened', required: true },
  // Submission status is independent of the candidate's progress stage.
  stage: { type: String, enum: APPLICATION_STAGES, default() { return this.status === 'applied' ? 'applied' : 'preparing'; }, required: true },
  version: { type: Number, default: 0, min: 0, required: true },
  timelineStartedAt: { type: Date, default: null },
  firstOpenedAt: { type: Date, default: Date.now },
  lastOpenedAt: { type: Date, default: Date.now },
  appliedAt: { type: Date, default: null },
  confirmationSource: { type: String, enum: ['', 'self_reported', 'email', 'auto_apply'], default: '' },
  evidence: { type: [new Schema({
    key: { type: String, required: true, maxlength: 300 },
    source: { type: String, required: true, enum: ['self_reported', 'email', 'auto_apply'] },
    observedAt: { type: Date, required: true },
    summary: { type: String, maxlength: 500, default: '' },
    reference: { type: String, maxlength: 300, default: '' },
  }, { _id: false })], default: [] },
}, { timestamps: true });

applicationSchema.index({ user: 1, job: 1 }, { unique: true });
applicationSchema.index({ user: 1, firstOpenedAt: -1, _id: -1 });
applicationSchema.index({ user: 1, status: 1, firstOpenedAt: -1, _id: -1 });
applicationSchema.index({ user: 1, stage: 1, firstOpenedAt: -1, _id: -1 });

export default model('Application', applicationSchema);
