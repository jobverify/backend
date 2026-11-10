import { Schema, model } from 'mongoose';
// The bounded reservation list makes admission atomic across API replicas.
const schema = new Schema({ _id: { type: String, default: 'pending' }, reportIds: { type: [String], default: [] } }, { versionKey: false });
export default model('JobVerificationQueue', schema);
