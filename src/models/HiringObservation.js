import { Schema, model } from 'mongoose';
const ranking = new Schema({ label: String, count: Number }, { _id: false });
const schema = new Schema({
  _id: { type: String, required: true, immutable: true },
  key: { type: String, required: true, unique: true, immutable: true },
  scope: { type: String, required: true, immutable: true },
  generatedAt: { type: Date, required: true, immutable: true },
  totalJobs: { type: Number, required: true, immutable: true },
  totalCompanies: { type: Number, required: true, immutable: true },
  companies: { type: [ranking], immutable: true }, locations: { type: [ranking], immutable: true }, jobTypes: { type: [ranking], immutable: true },
  coverage: { type: new Schema({ trackedSources: Number, successfulLastChecks: Number, partialLastChecks: Number }, { _id: false }), immutable: true },
}, { strict: true, versionKey: false });
schema.index({ scope: 1, generatedAt: -1 });
export default model('HiringObservation', schema);
