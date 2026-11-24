import { Schema, model } from 'mongoose';

const schema = new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  fingerprint: { type: String, required: true, immutable: true },
  facts: { type: Schema.Types.Mixed, required: true }, factsHash: { type: String, required: true },
  captions: { linkedin: String, instagram: String }, image: { type: Schema.Types.Mixed, default: null },
  origin: { type: String, enum: ['manual', 'instagram_auto'], default: 'manual' },
  instagramMediaType: { type: String, enum: ['image', 'reel'], default: 'image' },
  generation: { type: Schema.Types.Mixed, default: null }, video: { type: Schema.Types.Mixed, default: null },
  revision: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'needs_review', 'approved', 'publishing', 'complete', 'cancelled'], default: 'draft' },
  approvalHash: { type: String, default: null }, approvalAccounts: { type: [Schema.Types.Mixed], default: [] }, approvedAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ fingerprint: 1 }, { unique: true });
schema.index({ createdAt: -1 });
schema.index({ origin: 1, 'generation.state': 1, status: 1 });
schema.index({ 'generation.runIds': 1 });
export default model('SocialPost', schema);
