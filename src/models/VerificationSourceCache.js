import { Schema, model } from 'mongoose';
const schema = new Schema({ _id: String, payload: { type: Buffer, required: true }, observedAt: { type: Date, required: true }, expiresAt: { type: Date, required: true } }, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default model('VerificationSourceCache', schema);
