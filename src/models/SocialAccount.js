import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: { type: String, enum: ['linkedin', 'instagram'], required: true },
  destination: String, label: String, revision: { type: Number, default: 0 },
  status: { type: String, enum: ['ready', 'reconnect', 'disconnected'], default: 'disconnected' },
  accessToken: { type: String, select: false }, refreshToken: { type: String, select: false },
  scopes: [String], expiresAt: Date, refreshExpiresAt: Date, tokenIssuedAt: Date,
  refreshLeaseUntil: Date, pendingOAuth: { type: Schema.Types.Mixed, select: false },
  connectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export default model('SocialAccount', schema);
