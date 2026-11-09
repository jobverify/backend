import mongoose from 'mongoose';

export default mongoose.model('ScraperSchedule', new mongoose.Schema({
  _id: { type: String, default: 'global' },
  revision: { type: Number, default: 0 },
  mode: { type: String, enum: ['daily', 'interval'], required: true },
  time: String,
  hours: Number,
  startAt: String,
  nextRunAt: { type: Date, required: true },
  leaseUntil: { type: Date, default: () => new Date(0) },
  leaseToken: String,
  lastCheckedAt: Date,
  lastRunAt: Date,
  lastRunId: String,
  lastError: String,
}, { timestamps: true }));
