import { Schema, model } from 'mongoose';

const schema = new Schema({
  stateHash: { type: String, required: true, unique: true },
  nonceHash: { type: String, required: true },
  browserHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });

export default model('AppleAuthChallenge', schema);
