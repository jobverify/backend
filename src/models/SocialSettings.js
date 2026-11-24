import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: { type: String, enum: ['global'], required: true },
  paused: { type: Boolean, default: true }, revision: { type: Number, default: 0 }, fence: { type: Number, default: 0 },
  activeBatch: { type: new Schema({ id: String, slot: Date, startedAt: Date, deadline: Date, runId: String }, { _id: false }), default: null },
  instagramDrafts: { type: Schema.Types.Mixed, default: () => ({ enabled: false, matchAll: false, filters: {} }) },
  lastRunAt: Date, lastRunOutcome: String,
}, { timestamps: true });
export default model('SocialSettings', schema);
