import { Schema, model } from 'mongoose';

// A receipt is retained after fanout, even when sent delivery rows are cleaned
// up. Replaying an ingestion batch must never recreate that job's alerts.
const schema = new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  kind: { type: String, enum: ['job_published'], default: 'job_published', immutable: true },
  status: { type: String, enum: ['pending', 'processing', 'completed'], default: 'pending' },
  attemptCount: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  claimToken: { type: String, default: null },
  claimExpiresAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  outcome: { type: String, enum: ['', 'matched', 'job_unavailable'], default: '' },
  lastError: { type: String, maxlength: 100, default: '' },
}, { timestamps: true });

schema.index({ job: 1, kind: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
schema.index({ status: 1, claimExpiresAt: 1 });

export default model('JobAlertOutbox', schema, 'jobalertoutboxes');
