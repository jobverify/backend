import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { googleIdentity } from '../utils/googleAuth.js';
import { createVerificationTokenPair, hashVerificationToken, isAllowedAccountEmail, normalizeEmailAddress } from '../utils/authSecurity.js';
import { sendEmailChangeVerificationEmail } from '../utils/sendEmail.js';
import { resolveFrontendOrigin } from '../utils/runtimeConfig.js';

const reply = (res, status, message, extra = {}) => res.status(status).json({
  code: status, success: status < 400, message, ...extra,
});
const CHANGE_REQUEST_MESSAGE = 'If this address can be used, a verification link will be sent. Your current email stays active until verification succeeds.';
const INVALID_LINK_MESSAGE = 'Verification link is invalid or has expired. Request another email from your profile.';
const REAUTH_MESSAGE = 'Confirm your current password or sign in again with your linked Google account.';

export const getEmailChange = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+pendingEmailChange');
    const pending = user?.pendingEmailChange;
    return reply(res, 200, 'Email change status.', {
      pendingEmail: pending && pending.expiresAt > new Date()
        && pending.sessionVersion === (user.sessionVersion ?? 0) ? pending.email : null,
      authMethods: { password: Boolean(user?.password), google: Boolean(user?.google?.sub) },
    });
  } catch {
    return reply(res, 500, 'Unable to load email change status.');
  }
};

export const requestEmailChange = async (req, res) => {
  const email = normalizeEmailAddress(req.body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isAllowedAccountEmail(email)) {
    return reply(res, 400, 'Use a valid Gmail or educational email address.');
  }
  if (email === req.user.email) return reply(res, 400, 'Enter a different email address.');

  try {
    const user = await User.findById(req.user._id);
    if (!user || user.deactivated || (user.sessionVersion ?? 0) !== (req.user.sessionVersion ?? 0)) {
      return reply(res, 403, REAUTH_MESSAGE);
    }
    let authenticated = false;
    if (typeof req.body.currentPassword === 'string' && req.body.currentPassword.length <= 1024 && user.password) {
      authenticated = await bcrypt.compare(req.body.currentPassword, user.password);
    } else if (typeof req.body.credential === 'string' && req.body.credential.length <= 5000 && user.google?.sub) {
      try {
        const identity = await googleIdentity.verifyCredential(req.body.credential);
        const age = Date.now() / 1000 - identity.issuedAt;
        authenticated = identity.emailVerified && identity.sub === user.google.sub
          && normalizeEmailAddress(identity.email) === user.email
          && Number.isFinite(identity.issuedAt) && age >= -60 && age <= 300;
      } catch { /* Authentication failures never create a pending change. */ }
    }
    if (!authenticated) return reply(res, 403, REAUTH_MESSAGE);
    const pair = createVerificationTokenPair();
    const now = new Date();
    const pendingEmailChange = { email, tokenHash: pair.tokenHash, expiresAt: pair.expiresAt,
      requestedAt: now, sessionVersion: req.user.sessionVersion ?? 0 };
    const updated = await User.findOneAndUpdate({
      _id: req.user._id, email: req.user.email, deactivated: { $ne: true }, accountDeletingAt: null,
      // Pin the credential actually checked, as well as the authenticated session.
      password: user.password ?? null,
      'google.sub': user.google?.sub ?? null,
      sessionVersion: (req.user.sessionVersion ?? 0) === 0 ? { $in: [0, null] } : req.user.sessionVersion,
      $or: [{ 'pendingEmailChange.requestedAt': { $exists: false } },
        { 'pendingEmailChange.requestedAt': { $lte: new Date(now.getTime() - 60000) } }],
    }, { $set: { pendingEmailChange } }, { new: true });
    if (!updated) return reply(res, 429, 'Please wait a minute before requesting another verification email.');

    const link = new URL('/verify-email', resolveFrontendOrigin(process.env));
    link.searchParams.set('mode', 'change');
    link.hash = new URLSearchParams({ token: pair.token }).toString();
    try {
      await sendEmailChangeVerificationEmail(email, link.toString());
    } catch {
      // Do not erase a newer request if this delivery failed after another request started.
      await User.updateOne({ _id: req.user._id, 'pendingEmailChange.tokenHash': pair.tokenHash },
        { $unset: { pendingEmailChange: 1 } });
      return reply(res, 503, 'Unable to send the verification email. Please try again.');
    }
    // Availability is checked by the unique email index only at completion.
    // Requests and pending status behave identically for occupied addresses.
    return reply(res, 200, CHANGE_REQUEST_MESSAGE);
  } catch {
    return reply(res, 500, 'Unable to request an email change. Please try again.');
  }
};

export const verifyEmailChange = async (req, res) => {
  if (typeof req.body.token !== 'string' || !req.body.token || req.body.token.length > 256) {
    return reply(res, 400, INVALID_LINK_MESSAGE);
  }
  try {
    const filter = {
      'pendingEmailChange.tokenHash': hashVerificationToken(req.body.token),
      'pendingEmailChange.expiresAt': { $gt: new Date() },
      deactivated: { $ne: true }, accountDeletingAt: null,
      $expr: { $eq: [{ $ifNull: ['$sessionVersion', 0] }, '$pendingEmailChange.sessionVersion'] },
    };
    const user = await User.findOne(filter).select('+pendingEmailChange');
    if (!user) return reply(res, 400, INVALID_LINK_MESSAGE);
    const updated = await User.findOneAndUpdate({ ...filter, _id: user._id }, {
      $set: { email: user.pendingEmailChange.email, isVerified: true,
        resetPasswordTokenHash: null, resetPasswordExpiresAt: null },
      $unset: { pendingEmailChange: 1, google: 1 },
      $inc: { sessionVersion: 1 },
    }, { new: true });
    if (!updated) return reply(res, 400, INVALID_LINK_MESSAGE);
    return reply(res, 200, 'Your new email address is verified. Sign in with your new email address to continue.');
  } catch (error) {
    if (error.code === 11000) return reply(res, 400, INVALID_LINK_MESSAGE);
    return reply(res, 500, 'Unable to verify your new email address. Please try again.');
  }
};
