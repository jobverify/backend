/**
 * @file Controllers for user registration, verification, login, and session logout.
 * @module controllers/authController
 */

import User from "./../models/User.js";
import PendingUser from "../models/PendingUser.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import BlacklistedToken from "../models/BlacklistedToken.js";
import { sendValidationError } from "../middleware/validateRequest.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/sendEmail.js";
import { issueCsrfToken } from "../utils/csrf.js";
import {
  clearPendingRegistrationCookie,
  clearAuthCookie,
  getRequestCookie,
  getRequestAuthToken,
  PENDING_REGISTRATION_COOKIE_NAME,
  setPendingRegistrationCookie,
  setAuthCookie,
} from "../utils/authCookies.js";
import {
  createVerificationTokenPair,
  hashVerificationToken,
  isAllowedAccountEmail,
  normalizeEmailAddress,
} from "../utils/authSecurity.js";
import {
  isAccessExpired,
  buildAccessSummary,
} from "../utils/accessControl.js";
import { googleIdentity } from "../utils/googleAuth.js";
import { resolveFrontendOrigin } from "../utils/runtimeConfig.js";

const GENERIC_REGISTRATION_MESSAGE = "If this email can be registered, a verification email will be sent.";
const GENERIC_RESEND_MESSAGE = "If a pending registration exists for this email, a verification email will be sent when eligible.";
const GENERIC_PASSWORD_RESET_MESSAGE = "If an account exists for this email, a password reset link will be sent.";
const PASSWORD_RESET_SUCCESS_MESSAGE = "Password reset successfully. You can now sign in.";

const buildSessionUserPayload = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  accessRole: buildAccessSummary(user).accessRole,
  access: buildAccessSummary(user),
  profile: user.profile,
  onboardingCompleted: user.onboardingCompleted,
});

const GOOGLE_AUTH_FAILURE_MESSAGE = "Google sign-in failed. Please try again.";
const GOOGLE_EMAIL_VERIFICATION_MESSAGE = "Use a Google account with a verified email address to continue.";
const GOOGLE_ACCOUNT_LINK_CONFLICT_MESSAGE = "This account is already linked to a different Google sign-in.";
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// No account uses this hash. Keep failed unknown/passwordless-account requests
// on the same bcrypt work path as ordinary failed password authentication.
const LOGIN_DUMMY_HASH = "$2b$10$kj5DU.NpJDPidelRRzK.suchJqPe/5RuUp7/pqT1YqT4GEopVVpje";

// Generates a JWT token valid for 7 days.
const generateToken = (id, role, sessionVersion = 0) => {
  return jwt.sign({ id, role, sessionVersion }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const getTokenExpiresAt = (token) => {
  const decoded = jwt.decode(token);
  if (decoded?.exp) {
    return new Date(decoded.exp * 1000);
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};

const getFrontendOrigin = () => resolveFrontendOrigin(process.env);

const buildFrontendVerifySuccessUrl = () => {
  const url = new URL("/verify-email", getFrontendOrigin());
  url.searchParams.set("verified", "1");
  return url.toString();
};

const buildVerificationLink = (verificationToken) => {
  const url = new URL("/verify-email", getFrontendOrigin());
  url.hash = new URLSearchParams({ token: verificationToken }).toString();
  return url.toString();
};

const buildPasswordResetLink = (resetToken) => {
  const url = new URL("/reset-password", getFrontendOrigin());
  url.hash = new URLSearchParams({ token: resetToken }).toString();
  return url.toString();
};

const buildGoogleMetadata = (identity, currentGoogle = {}) => ({
  sub: identity.sub,
  picture: identity.picture ?? currentGoogle.picture ?? null,
  linkedAt: currentGoogle.linkedAt ?? new Date(),
});

const issueAuthenticatedSession = async (user, res, successMessage = "Logged in successfully") => {
  if (!user.isNew) {
    const sessionVersion = user.sessionVersion ?? 0;
    // Mongoose merges Document.$where into the save filter. Only the credential
    // state that was authenticated may complete this sign-in.
    user.$where = { ...user.$where, password: user.password ?? null,
      sessionVersion: sessionVersion === 0 ? { $in: [0, null] } : sessionVersion,
      deactivated: { $ne: true } };
  }
  const accessChanged = isAccessExpired(user);

  user.lastLoginAt = new Date();
  try {
    await user.save();
  } catch (error) {
    if (!['DocumentNotFoundError', 'VersionError'].includes(error.name)) throw error;
    return res.status(401).json({ code: 401, success: false, message: 'Invalid credentials' });
  }

  const token = generateToken(user._id, user.role, user.sessionVersion ?? 0);
  setAuthCookie(res, token);

  return res.status(200).json({
    code: 200,
    success: true,
    message: successMessage,
    user: buildSessionUserPayload(user),
    accessChanged,
  });
};

export const getCsrfToken = (req, res) => {
  const token = issueCsrfToken(req, res);

  res.status(200).json({
    code: 200,
    success: true,
    token,
  });
};

// Registers a new user, stores a pending record, and sends a verification link.
export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const { name, email } = req.body;
  const normalizedEmail = normalizeEmailAddress(email);

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(201).json({
        code: 201,
        success: true,
        pending: true,
        email: normalizedEmail,
        message: GENERIC_REGISTRATION_MESSAGE,
      });
    }

    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
    if (pendingUser) {
      return res.status(201).json({
        code: 201,
        success: true,
        pending: true,
        email: normalizedEmail,
        message: GENERIC_REGISTRATION_MESSAGE,
      });
    }

    const verificationToken = createVerificationTokenPair();

    const pending = new PendingUser({
      email: normalizedEmail,
      password: null,
      profile: { name },
      verificationTokenHash: verificationToken.tokenHash,
      verificationTokenExpiresAt: verificationToken.expiresAt,
      lastResentAt: new Date(), // initialized to register time
    });

    await pending.save();

    const magicLink = buildVerificationLink(verificationToken.token);
    sendVerificationEmail(normalizedEmail, magicLink).catch((err) => {
      console.error(`[Email Delivery Error] Failed to send email to ${normalizedEmail}:`, err.message);
    });
    res.status(201).json({
      code: 201,
      success: true,
      pending: true,
      email: normalizedEmail,
      message: GENERIC_REGISTRATION_MESSAGE,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      code: 500,
      success: false,
      message: "Server Error",
    });
  }
};

// Redirects verification links into the frontend flow so account creation happens over POST.
export const redirectVerifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: "Verification token is required",
    });
  }

  return res.redirect(buildVerificationLink(token));
};

// Only the mailbox owner holding the link may establish the account password.
export const verifyEmail = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const { token, password } = req.body;

  try {
    const tokenHash = hashVerificationToken(token);
    const pendingUser = await PendingUser.findOne({
      $or: [
        {
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: { $gt: new Date() },
        },
        {
          verificationToken: token,
          verificationTokenExpiresAt: { $gt: new Date() },
        },
      ],
    });

    if (!pendingUser) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Verification token expired or invalid user.",
      });
    }

    const existingUser = await User.findOne({ email: pendingUser.email });
    if (existingUser) {
      await PendingUser.deleteOne({ email: pendingUser.email });
      clearPendingRegistrationCookie(res);
      return res.status(409).json({
        code: 409,
        success: false,
        message: "An account for this email already exists. Please sign in.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Consume the exact live token and create its account in one commit. A
    // storage failure rolls back consumption so the owner can retry the link.
    const created = await User.db.transaction(async session => {
      const consumed = await PendingUser.findOneAndDelete({
        _id: pendingUser._id,
        verificationTokenExpiresAt: { $gt: new Date() },
        $or: [{ verificationTokenHash: tokenHash }, { verificationToken: token }],
      }, { session });
      if (!consumed) return null;
      const user = new User({
        email: consumed.email,
        telegramAlertsAllowed: false,
        password: passwordHash,
        profile: consumed.profile ? { name: consumed.profile.name } : {},
        isVerified: true,
        lastLoginAt: new Date(),
      });
      await user.save({ session });
      return user;
    });
    if (!created) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Verification link is invalid or has expired.',
      });
    }

    clearPendingRegistrationCookie(res);

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Email verified successfully. You can now sign in.",
      redirectTo: buildFrontendVerifySuccessUrl(),
    });
  } catch (err) {
    console.error('Email verification could not complete.');
    if (err?.code === 11000) {
      return res.status(409).json({
        code: 409,
        success: false,
        message: "An account for this email already exists. Please sign in.",
      });
    }
    return res.status(503).json({
      code: 503,
      success: false,
      message: 'Unable to complete verification. Please try the same link again.',
    });
  }
};

// Resends verification email, enforcing DB-level max limits and cooldown timers.
export const resendVerification = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const { email } = req.body;
  const normalizedEmail = normalizeEmailAddress(email);

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(200).json({
        code: 200,
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    }

    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
    if (!pendingUser) {
      return res.status(200).json({
        code: 200,
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    }

    const now = new Date();
    const resendWindowStartedAt = pendingUser.resendWindowStartedAt;
    if (resendWindowStartedAt && now - resendWindowStartedAt >= RESEND_LIMIT_WINDOW_MS) {
      pendingUser.resendCount = 0;
      pendingUser.resendWindowStartedAt = null;
    }

    // Exhaustion check (Max 2 resends per rolling 24-hour window)
    if (pendingUser.resendCount >= 2) {
      return res.status(200).json({
        code: 200,
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    }

    // 60 second cooldown check between resends
    if (now - pendingUser.lastResentAt < RESEND_COOLDOWN_MS) {
      return res.status(200).json({
        code: 200,
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    }

    const verificationToken = createVerificationTokenPair();

    pendingUser.verificationToken = null;
    pendingUser.verificationTokenHash = verificationToken.tokenHash;
    pendingUser.verificationTokenExpiresAt = verificationToken.expiresAt;
    pendingUser.resendWindowStartedAt ??= now;
    pendingUser.resendCount += 1;
    pendingUser.lastResentAt = now;
    pendingUser.createdAt = now;
    await pendingUser.save();

    const magicLink = buildVerificationLink(verificationToken.token);
    sendVerificationEmail(normalizedEmail, magicLink).catch((err) => {
      console.error(`[Email Delivery Error] Failed to send email to ${normalizedEmail}:`, err.message);
    });

    res.status(200).json({
      code: 200,
      success: true,
      message: GENERIC_RESEND_MESSAGE,
    });
  } catch (err) {
    console.error("Resend verification failed:", err.message);
    res.status(500).json({
      code: 500,
      success: false,
      message: "Server Error",
    });
  }
};

// Starts the password reset flow while keeping account existence private.
export const requestPasswordReset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const normalizedEmail = normalizeEmailAddress(req.user?.email ?? req.body.email);

  try {
    const user = req.user ?? await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({
        code: 200,
        success: true,
        message: GENERIC_PASSWORD_RESET_MESSAGE,
      });
    }

    const resetToken = createVerificationTokenPair();
    const resetLink = buildPasswordResetLink(resetToken.token);
    // Public recovery may issue a link, but must not revoke a still-valid link
    // already held by the mailbox owner. The CAS also coalesces concurrent calls.
    const version = user.sessionVersion ?? 0;
    const reserved = await User.findOneAndUpdate({
      _id: user._id, email: normalizedEmail, accountDeletingAt: null,
      sessionVersion: version === 0 ? { $in: [0, null] } : version,
      $or: [{ resetPasswordTokenHash: null }, { resetPasswordExpiresAt: null },
        { resetPasswordExpiresAt: { $lte: new Date() } }],
    }, { $set: { resetPasswordTokenHash: resetToken.tokenHash, resetPasswordExpiresAt: resetToken.expiresAt } }, { new: true });
    if (!reserved) {
      return res.status(200).json({ code: 200, success: true, message: req.user
        ? 'If a reset link is already active, use the email you received. Check your inbox and spam folder.'
        : GENERIC_PASSWORD_RESET_MESSAGE });
    }
    const delivery = sendPasswordResetEmail(normalizedEmail, resetLink).catch(async () => {
      console.error('Password reset email delivery failed.');
      // A late SMTP failure must never erase a different, newer token.
      await User.updateOne({ _id: user._id, resetPasswordTokenHash: resetToken.tokenHash },
        { $set: { resetPasswordTokenHash: null, resetPasswordExpiresAt: null } })
        .catch(() => console.error('Password reset reservation cleanup failed.'));
      if (req.user) throw new Error('Password reset delivery failed.');
    });
    // Only the authenticated profile flow can expose delivery status. Keep
    // public recovery responses and their timing independent of SMTP delivery.
    if (req.user) {
      try {
        await delivery;
      } catch {
        return res.status(503).json({
          code: 503,
          success: false,
          message: 'Unable to send the reset email. Please try again.',
        });
      }
    }

    return res.status(200).json({
      code: 200,
      success: true,
      message: req.user
        ? 'Password reset email sent. Check your inbox and spam folder.'
        : GENERIC_PASSWORD_RESET_MESSAGE,
    });
  } catch (err) {
    console.error("Forgot password failed:", err.message);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server Error",
    });
  }
};

// Resets a password after validating a time-limited reset token.
export const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const { token, password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordTokenHash: hashVerificationToken(token),
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Password reset link is invalid or has expired.",
      });
    }

    const sessionVersion = user.sessionVersion ?? 0;
    const passwordHash = await bcrypt.hash(password, 10);
    // Consume the still-live token with the credentials we read. A reset,
    // password change or token rotation during hashing must win atomically.
    const updated = await User.findOneAndUpdate({
      _id: user._id,
      resetPasswordTokenHash: hashVerificationToken(token),
      resetPasswordExpiresAt: { $gt: new Date() },
      password: user.password ?? null,
      sessionVersion: sessionVersion === 0 ? { $in: [0, null] } : sessionVersion,
    }, {
      $set: {
        password: passwordHash,
        passwordChangedAt: new Date(),
        sessionVersion: sessionVersion + 1,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    }, { new: true });
    if (!updated) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Password reset link is invalid or has expired.",
      });
    }

    return res.status(200).json({
      code: 200,
      success: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    });
  } catch (err) {
    console.error("Password reset failed:", err.message);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server Error",
    });
  }
};

// Requires the existing password and renews this browser's session after revoking older sessions.
export const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors);

  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user || (user.sessionVersion ?? 0) !== (req.user.sessionVersion ?? 0)) {
      return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
    }
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'You signed up with Google, so no password was set. Use "Send password reset email" to set a custom password.' });
    }
    if (!await bcrypt.compare(oldPassword, user.password)) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect.' });
    }

    // Match the credentials we verified so concurrent changes cannot overwrite each other.
    const sessionVersion = user.sessionVersion ?? 0;
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        password: user.password,
        sessionVersion: sessionVersion === 0 ? { $in: [0, null] } : sessionVersion,
      },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 10),
          passwordChangedAt: new Date(),
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          sessionVersion: sessionVersion + 1,
        },
      },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Your password or session changed. Please sign in again and retry.' });
    }
    setAuthCookie(res, generateToken(updated._id, updated.role, updated.sessionVersion));
    return res.status(200).json({ success: true, message: 'Password changed successfully. Other sessions have been signed out.' });
  } catch (err) {
    console.error('Password change failed:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to change password. Please try again.' });
  }
};

// Authenticates user credentials and issues a JWT token.
export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const { email, password } = req.body;
  const normalizedEmail = normalizeEmailAddress(email);

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
      const pendingPasswordMatches = await bcrypt.compare(password, pendingUser?.password || LOGIN_DUMMY_HASH);
      if (pendingUser?.password) {
        if (pendingPasswordMatches) {
          return res.status(401).json({
            code: 401,
            success: false,
            message: "Your email verification is pending. Please verify your email to log in.",
          });
        }
      }
      return res.status(401).json({
        code: 401,
        success: false,
        message: "Incorrect email or password. Please try again or reset your password.",
      });
    }

    if (!user.password) {
      await bcrypt.compare(password, LOGIN_DUMMY_HASH);
      return res.status(401).json({
        code: 401,
        success: false,
        message: "Incorrect email or password. Please try again or reset your password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: "Incorrect email or password. Please try again or reset your password.",
      });
    }

    if (user.deactivated) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }
    return issueAuthenticatedSession(user, res);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      code: 500,
      success: false,
      message: "Server Error",
    });
  }
};

export const authenticateWithGoogle = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors);
  }

  const credential = String(req.body?.credential ?? "").trim();
  if (!credential) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: "Google credential is required.",
    });
  }

  try {
    const identity = await googleIdentity.verifyCredential(credential);

    if (!identity.emailVerified || !identity.email || !identity.sub) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: GOOGLE_EMAIL_VERIFICATION_MESSAGE,
      });
    }

    const normalizedEmail = normalizeEmailAddress(identity.email);
    if (!isAllowedAccountEmail(normalizedEmail)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Use a Gmail or educational email address.",
      });
    }
    const existingUser = await User.findOne({ email: normalizedEmail });

    // Google is authoritative for Gmail and signed Workspace identities. A
    // third-party education email can outlive its mailbox ownership; only an
    // already-bound Google subject may authenticate without a mailbox challenge.
    const authoritativeEmail = normalizedEmail.endsWith('@gmail.com')
      || (typeof identity.hostedDomain === 'string' && Boolean(identity.hostedDomain.trim()));
    if (!authoritativeEmail && existingUser?.google?.sub !== identity.sub) {
      return res.status(409).json({ code: 409, success: false,
        message: 'Google sign-in cannot verify current ownership of this email. Use email registration or sign in with your password.' });
    }

    if (existingUser) {
      if (existingUser.deactivated) {
        return res.status(403).json({
          code: 403,
          success: false,
          message: "Your account has been deactivated. Please contact support.",
        });
      }

      if (existingUser.google?.sub && existingUser.google.sub !== identity.sub) {
        return res.status(409).json({
          code: 409,
          success: false,
          message: GOOGLE_ACCOUNT_LINK_CONFLICT_MESSAGE,
        });
      }

      const profileName = String(existingUser.profile?.name ?? "").trim().toLowerCase();
      if (identity.name && (!profileName || profileName === normalizedEmail)) {
        existingUser.profile ??= {};
        existingUser.profile.name = identity.name;
      }
      existingUser.$where = { ...existingUser.$where, 'google.sub': existingUser.google?.sub ?? null };
      existingUser.google = buildGoogleMetadata(identity, existingUser.google);
      existingUser.isVerified = true;
      return issueAuthenticatedSession(existingUser, res, "Logged in successfully");
    }

    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
    if (pendingUser) {
      const promotedUser = new User({
        email: normalizedEmail,
        telegramAlertsAllowed: false,
        // Pending registration data may belong to someone else. Trust only the
        // verified Google identity; email sign-in can be added by password reset.
        password: null,
        profile: identity.name ? { name: identity.name } : {},
        google: buildGoogleMetadata(identity),
        isVerified: true,
      });

      await promotedUser.save();
      await PendingUser.deleteOne({ email: normalizedEmail });
      clearPendingRegistrationCookie(res);
      return issueAuthenticatedSession(promotedUser, res, "Logged in successfully");
    }

    const newUser = new User({
      email: normalizedEmail,
      telegramAlertsAllowed: false,
      password: null,
      profile: identity.name
        ? {
          name: identity.name,
        }
        : {},
      google: buildGoogleMetadata(identity),
      isVerified: true,
    });

    return issueAuthenticatedSession(newUser, res, "Logged in successfully");
  } catch (error) {
    console.error("Google authentication failed:", error.message);
    return res.status(401).json({
      code: 401,
      success: false,
      message: GOOGLE_AUTH_FAILURE_MESSAGE,
    });
  }
};

// Invalidates the current user token by adding it to a blacklist.
export const logout = async (req, res) => {
  // Clear this browser even when persistence fails; report that failure so a
  // copied bearer token is never falsely described as durably revoked.
  clearAuthCookie(res);
  try {
    const token = getRequestAuthToken(req);
    if (token) {
      try {
        await BlacklistedToken.create({ token, expiresAt: getTokenExpiresAt(token) });
      } catch (error) {
        // The token is the model's only unique value; repeated revocation is
        // idempotent. All other storage failures must reach the error response.
        if (error.code !== 11000) throw error;
      }
    }

    res.status(200).json({
      code: 200,
      success: true,
      message: "Logged out successfully!",
    });
  } catch {
    // Database errors can contain duplicate-key/token data; log no raw error.
    console.error("Logout revocation failed.");
    res.status(500).json({
      code: 500,
      success: false,
      message: "Logout Failed!",
    });
  }
};
