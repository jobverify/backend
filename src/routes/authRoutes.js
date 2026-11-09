/**
 * @file Express routes for user authentication, email verification, and session management.
 * @module routes/authRoutes
 */

import express from "express";
import { getEmailChange, requestEmailChange, verifyEmailChange } from '../controllers/emailChangeController.js';
import {
  authenticateWithGoogle,
  changePassword,
  getCsrfToken,
  login,
  logout,
  register,
  requestPasswordReset,
  redirectVerifyEmail,
  resetPassword,
  verifyEmail,
  resendVerification,
} from "../controllers/authController.js";
import { protect, protectLogout } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { requireTurnstileCaptcha } from "../middleware/turnstileCaptcha.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import {
  forgotPasswordValidation,
  changePasswordValidation,
  googleAuthValidation,
  loginValidation,
  registerValidation,
  resetPasswordValidation,
  resendValidation,
  verifyEmailValidation,
} from "../validation/requestValidators.js";

// Limits account registrations to prevent registration spam.
const registerLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: {
    code: 429,
    success: false,
    message: "Too many accounts created, please try again after 24 hours",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    code: 429,
    success: false,
    message: "Too many sign-in attempts, please try again after 5 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limits email verification resends to prevent mailing abuse.
const resendLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    code: 429,
    success: false,
    message: "Too many resend attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limits password reset requests to reduce enumeration and delivery abuse.
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    code: 429,
    success: false,
    message: "Too many password reset attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
const emailChangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3,
  message: { code: 429, success: false, message: 'Too many email change requests. Please try again after 15 minutes.' },
  standardHeaders: true, legacyHeaders: false });
const emailChangeVerificationLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20,
  message: { code: 429, success: false, message: 'Too many verification attempts. Please try again after 15 minutes.' },
  standardHeaders: true, legacyHeaders: false });

// Routes definitions
router.get("/csrf-token", getCsrfToken);
router.post("/register", registerLimiter, registerValidation, validateRequest, register);
router.post(
  "/google",
  loginLimiter,
  googleAuthValidation,
  validateRequest,
  authenticateWithGoogle,
);
router.post(
  "/login",
  loginLimiter,
  loginValidation,
  validateRequest,
  requireTurnstileCaptcha(),
  login,
);
router.post("/logout", protectLogout, logout);
router.get('/email-change', protect, getEmailChange);
router.post('/change-email', protect, emailChangeLimiter, resendValidation, validateRequest, requestEmailChange);
router.post('/verify-email-change', emailChangeVerificationLimiter, verifyEmailChange);
router.post('/change-password', protect, loginLimiter, changePasswordValidation, validateRequest, changePassword);
router.post('/send-reset-email', protect, forgotPasswordLimiter, requestPasswordReset);
router.get("/verify-email", redirectVerifyEmail);
router.post("/verify-email", verifyEmailValidation, validateRequest, verifyEmail);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPasswordValidation,
  validateRequest,
  requestPasswordReset,
);
router.post("/reset-password", resetPasswordValidation, validateRequest, resetPassword);
router.post(
  "/resend-verification",
  resendLimiter,
  resendValidation,
  validateRequest,
  resendVerification,
);

export default router;
