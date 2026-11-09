import { Schema, model } from 'mongoose';

const skills = { type: [String], default: [], validate: value => value.length <= 30 && value.every(skill => skill.length <= 80) };
const ExperienceSchema = new Schema({
  id: { type: String, required: true },
  kind: { type: String, enum: ['job', 'project'], required: true },
  company: { type: String, default: '', maxlength: 160 },
  role: { type: String, required: true, maxlength: 160 },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  current: { type: Boolean, default: false },
  summary: { type: String, default: '', maxlength: 2000 },
  skills,
}, { _id: false });

const AchievementSchema = new Schema({
  id: { type: String, required: true },
  experienceId: { type: String, default: null },
  claim: { type: String, required: true, maxlength: 800 },
  context: { type: String, default: '', maxlength: 1500 },
  metrics: { type: String, default: '', maxlength: 500 },
  skills,
  provenance: { type: String, enum: ['manual', 'cv_import', 'agent_inferred'], required: true },
  sourceRef: { type: String, default: '', maxlength: 500 },
  confirmed: { type: Boolean, default: true },
}, { _id: false });

// The owner's ID is the document ID, making even concurrent first writes unique.
const CandidateEvidenceSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, ref: 'User' },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  version: { type: Number, default: 0, min: 0 },
  // CV publishing writes this field in its transaction to fence concurrent edits.
  generationFence: { type: Number, default: 0, min: 0 },
  experiences: { type: [ExperienceSchema], default: [], validate: value => value.length <= 50 },
  achievements: { type: [AchievementSchema], default: [], validate: value => value.length <= 200 },
}, { timestamps: true, versionKey: false });

export default model('CandidateEvidence', CandidateEvidenceSchema);
