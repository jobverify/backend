import { sendEmailChangeViaRelay, sendPasswordResetViaRelay, sendVerificationViaRelay } from '../../../src/utils/passwordResetRelay.js';
let relay;
export function bindEmailRelay(binding) {
  if (typeof binding?.fetch !== 'function') throw new Error('Email relay service binding is required.');
  relay = binding;
}
const fetchRelay = (url, options) => relay.fetch(url, options);
export const sendVerificationEmail = (to, link) => sendVerificationViaRelay(to, link, fetchRelay);
export const sendEmailChangeVerificationEmail = (to, link) => sendEmailChangeViaRelay(to, link, fetchRelay);
export const sendPasswordResetEmail = (to, link) => sendPasswordResetViaRelay(to, link, fetchRelay);
