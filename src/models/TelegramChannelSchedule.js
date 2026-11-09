import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true },
  nextPostAt: { type: Date, default: null },
  lastSentAt: { type: Date, default: null },
  claimToken: { type: String, default: null },
  claimExpiresAt: { type: Date, default: null },
}, { timestamps: true });
export default model('TelegramChannelSchedule', schema);
