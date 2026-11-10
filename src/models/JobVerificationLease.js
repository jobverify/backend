import { Schema, model } from 'mongoose';
const schema = new Schema({ _id: String, token: String, leaseUntil: { type: Date, required: true } }, { versionKey: false });
export default model('JobVerificationLease', schema);
