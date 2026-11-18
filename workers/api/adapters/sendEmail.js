import { sendEmailChangeViaRelay, sendPasswordResetViaRelay, sendVerificationViaRelay } from '../../../src/utils/passwordResetRelay.js';
export const sendVerificationEmail = sendVerificationViaRelay;
export const sendEmailChangeVerificationEmail = sendEmailChangeViaRelay;
export const sendPasswordResetEmail = sendPasswordResetViaRelay;
