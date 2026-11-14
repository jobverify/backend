import { Schema, model } from 'mongoose';

// A deletion retry contains no account id, Apple subject, email or name.
const schema = new Schema({
  _id: { type: String },
  encryptedToken: { type: String, required: true, select: false, maxlength: 15000 },
  clientId: { type: String, required: true, maxlength: 255 },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false, toJSON: { transform(doc, ret) { delete ret.encryptedToken; return ret; } } });

export default model('AppleTokenRevocation', schema);
