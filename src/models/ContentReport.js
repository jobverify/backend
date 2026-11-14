import { Schema, model } from 'mongoose';
import { REPORT_CATEGORIES, REPORT_STATUSES } from '../services/contentReportPolicy.js';

const history = new Schema({ actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true }, status: { type: String, enum: REPORT_STATUSES, required: true },
  notes: { type: String, required: true, maxlength: 3000 }, copiesChecked: Boolean }, { _id: false });
const schema = new Schema({
  _id: { type: String, required: true },
  category: { type: String, enum: REPORT_CATEGORIES, required: true, immutable: true },
  contentUrl: { type: String, required: true, maxlength: 2048, immutable: true },
  explanation: { type: String, required: true, maxlength: 5000, immutable: true },
  email: { type: String, maxlength: 254, immutable: true },
  signature: { type: String, maxlength: 200, immutable: true },
  authority: { type: String, enum: ['', 'depicted_person', 'authorized_representative'], immutable: true },
  goodFaith: { type: Boolean, required: true, immutable: true },
  nonConsent: { type: Boolean, immutable: true },
  relatedReference: { type: String, maxlength: 80, immutable: true },
  receivedAt: { type: Date, required: true, immutable: true },
  dueAt: { type: Date, required: true, immutable: true },
  status: { type: String, enum: REPORT_STATUSES, default: 'received', required: true },
  revision: { type: Number, default: 0, min: 0, required: true },
  history: { type: [history], default: [] },
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, dueAt: 1, _id: 1 });
export default model('ContentReport', schema);
