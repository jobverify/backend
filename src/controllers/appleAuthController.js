import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import { ASCII_EMAIL_MESSAGE, isAsciiEmailIdentity } from '../utils/authSecurity.js';
import PendingUser from '../models/PendingUser.js';
import AppleAuthChallenge from '../models/AppleAuthChallenge.js';
import { issueAuthenticatedSession } from './authController.js';
import { clearPendingRegistrationCookie, getCookieSecurityOptions, getRequestCookie } from '../utils/authCookies.js';
import { appleIdentity, encryptAppleRefreshToken, hashAppleChallenge, readAppleConfig, sanitizeAppleName } from '../utils/appleAuth.js';

const COOKIE = 'jobverify_apple_challenge';
const TTL = 5 * 60 * 1000;
const cookieOptions = () => ({ ...getCookieSecurityOptions(), path: '/api/auth', httpOnly: true });
const reply = (res, status, message) => res.status(status).json({ code: status, success: status < 400, message });

export const getAppleConfiguration = (req, res) => {
  const config = readAppleConfig();
  return res.status(200).json(config ? { enabled: true, clientId: config.clientId } : { enabled: false });
};

export const createAppleChallenge = async (req, res) => {
  const config = readAppleConfig();
  if (!config) return reply(res, 503, 'Apple sign-in is unavailable right now.');
  try {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const browser = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TTL);
    await AppleAuthChallenge.create({ stateHash: hashAppleChallenge(state), nonceHash: hashAppleChallenge(nonce),
      browserHash: hashAppleChallenge(browser), expiresAt });
    res.cookie(COOKIE, browser, { ...cookieOptions(), maxAge: TTL });
    return res.status(200).json({ state, nonce, clientId: config.clientId, redirectURI: config.redirectURI, expiresAt });
  } catch { return reply(res, 503, 'Apple sign-in is unavailable right now.'); }
};

export const authenticateWithApple = async (req, res) => {
  const config = readAppleConfig();
  if (!config) return reply(res, 503, 'Apple sign-in is unavailable right now.');
  const { state, idToken, code } = req.body ?? {};
  const browser = getRequestCookie(req, COOKIE);
  if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)
    || typeof browser !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(browser)
    || typeof idToken !== 'string' || !idToken || idToken.length > 12000
    || typeof code !== 'string' || !code || code.length > 5000) {
    return reply(res, 401, 'Apple sign-in expired or could not be verified. Please try again.');
  }
  try {
    // Atomic consumption works across API instances, including two callbacks at once.
    const challenge = await AppleAuthChallenge.findOneAndDelete({ stateHash: hashAppleChallenge(state),
      browserHash: hashAppleChallenge(browser), expiresAt: { $gt: new Date() } });
    res.clearCookie(COOKIE, cookieOptions());
    if (!challenge) return reply(res, 401, 'Apple sign-in expired or could not be verified. Please try again.');
    const identity = await appleIdentity.verifyResponse({ idToken, code, nonceHash: challenge.nonceHash });
    let user = await User.findOne({ 'apple.sub': identity.sub }).select('+accountDeletingAt');
    if (user?.deactivated || user?.accountDeletingAt) return reply(res, 403, 'This account is unavailable. Please contact support.');
    if (!user) {
      if (!identity.email || !identity.emailVerified) return reply(res, 400, 'Apple must share a verified email address to create your account.');
      if (identity.emailIsAscii === false || !isAsciiEmailIdentity(identity.email)) return reply(res, 400, ASCII_EMAIL_MESSAGE);
      // Email alone is never permission to link an Apple identity to an account.
      if (await User.exists({ email: identity.email })) return reply(res, 409,
        'An account already uses this email. Sign in with your existing method.');
      const name = sanitizeAppleName(req.body.name);
      user = new User({ email: identity.email, password: null, isVerified: true, telegramAlertsAllowed: false,
        profile: name ? { name } : {}, apple: { sub: identity.sub, clientId: config.clientId,
          privateEmail: identity.privateEmail, linkedAt: new Date() } });
    }
    // Pin the identity and cleanup state until the normal session save commits.
    user.$where = { 'apple.sub': identity.sub, accountDeletingAt: null };
    user.set('apple.refreshToken', encryptAppleRefreshToken(identity.refreshToken, config.tokenEncryptionKey));
    await user.save();
    await PendingUser.deleteOne({ email: user.email });
    clearPendingRegistrationCookie(res);
    return issueAuthenticatedSession(user, res);
  } catch (error) {
    if (error.code === 11000) return reply(res, 409, 'An account already uses these sign-in details. Use your existing sign-in method.');
    return reply(res, 401, 'Apple sign-in failed. Please try again.');
  }
};
