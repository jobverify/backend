import { Schema } from 'mongoose';
import { MIN_SIGNUP_AGE, AGE_POLICY_VERSION } from '../utils/signupAge.js';

// Store the age decision rather than a birth date. Older accounts remain valid.
export default new Schema({
  minimumAge: { type: Number, enum: [MIN_SIGNUP_AGE], required: true },
  policyVersion: { type: String, enum: [AGE_POLICY_VERSION], required: true },
  checkedAt: { type: Date, required: true },
}, { _id: false });
