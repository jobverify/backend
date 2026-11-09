import { Schema, model } from 'mongoose';
import { DEFAULT_BROADCAST_TEMPLATE } from '../services/telegramBroadcastTemplate.js';

const schema = new Schema({
  _id: { type: String, enum: ['channel', 'group'], required: true },
  enabled: { type: Boolean, default: false },
  chatId: { type: String, default: '' },
  minIntervalMinutes: { type: Number, default: 20, min: 1, max: 1440 },
  maxIntervalMinutes: { type: Number, default: 30, min: 1, max: 1440 },
  startTime: { type: String, default: '', match: /^$|^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, default: '', match: /^$|^([01]\d|2[0-3]):[0-5]\d$/ },
  postingWindows: { type: [new Schema({
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  }, { _id: false })], default: undefined },
  matchAll: { type: Boolean, default: false },
  filters: { type: Schema.Types.Mixed, default: () => ({}) },
  template: { type: String, default: DEFAULT_BROADCAST_TEMPLATE },
  revision: { type: Number, default: 0 },
  dispatchRevision: { type: Number, default: 0 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
schema.index({ chatId: 1 }, { unique: true, partialFilterExpression: { chatId: { $gt: '' } } });
export default model('TelegramBroadcastSettings', schema);
