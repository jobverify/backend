/**
 * @file Email delivery utility using an authenticated SMTP server.
 * @module utils/sendEmail
 */

import nodemailer from "nodemailer";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { sendPasswordResetViaRelay } from "./passwordResetRelay.js";

const requireEmailConfig = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    console.error(`[Email Error] ${name} is not defined or cannot be accessed in the .env configuration.`);
    throw new Error(`${name} environment variable is not defined.`);
  }
  return value;
};

const getSmtpConfig = async () => {
  const port = Number.parseInt(requireEmailConfig("SMTP_PORT"), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port number.");
  }

  const hostname = requireEmailConfig("SMTP_HOST");
  const host = isIP(hostname)
    ? hostname
    : (await lookup(hostname, { family: 4 })).address;

  return {
    host,
    port,
    secure: String(process.env.SMTP_SECURE ?? "").trim().toLowerCase() === "true",
    auth: {
      user: requireEmailConfig("SMTP_USER"),
      pass: requireEmailConfig("SMTP_PASS"),
    },
    tls: isIP(hostname) ? undefined : { servername: hostname },
  };
};

const sendEmail = async (to, subject, html, successLabel) => {
  const transporter = nodemailer.createTransport(await getSmtpConfig());
  const result = await transporter.sendMail({
    from: requireEmailConfig("SMTP_FROM"),
    to,
    subject,
    html,
  });

  console.log(`[Email Success] ${successLabel} sent to ${to}. Message ID: ${result.messageId ?? "unknown"}`);
  return result;
};

// Sends a verification email containing a registration magic link.
export const sendVerificationEmail = async (to, magicLink) => sendEmail(
  to,
  "Verify your Jobverify account",
  `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b;">Welcome to Jobverify!</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.5;">
        Thank you for signing up. Please click the button below to verify your email address and access your account. This link is valid for 30 minutes.
      </p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${magicLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        If the button above does not work, copy and paste the following link into your web browser:
      </p>
      <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
        <a href="${magicLink}">${magicLink}</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        If you did not request this email, you can safely ignore it.
      </p>
    </div>
  `,
  "Verification email",
);

export const sendEmailChangeVerificationEmail = async (to, link) => sendEmail(
  to,
  'Verify your new Jobverify email address',
  `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2>Verify your new email address</h2>
    <p>Click the link below to use this email address for your Jobverify account. This link expires in 30 minutes.</p>
    <p><a href="${link}">Verify new email address</a></p>
    <p>Your current email address stays active until you verify. After verification, sign in with your new email address. If you use Google sign-in, use Google with the new email, or choose Forgot password to set a password.</p>
    <p>If you did not request this change, ignore this email.</p>
  </div>`,
  'Email change verification',
);

// Sends a password reset email containing a time-limited reset link.
export const sendPasswordResetEmail = async (to, resetLink) => String(process.env.EMAIL_RELAY_URL ?? '').trim()
  ? sendPasswordResetViaRelay(to, resetLink)
  : sendEmail(
  to,
  "Reset your Jobverify password",
  `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b;">Reset your Jobverify password</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.5;">
        We received a request to reset your password. Click the button below to choose a new password. This link is valid for 30 minutes.
      </p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        If the button above does not work, copy and paste the following link into your web browser:
      </p>
      <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
        <a href="${resetLink}">${resetLink}</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `,
  "Password reset email",
);
