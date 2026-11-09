import crypto from "node:crypto";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_POLICY_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters, include uppercase, lowercase, and a number, and use at most ${PASSWORD_MAX_BYTES} UTF-8 bytes.`;
export const VERIFICATION_TOKEN_TTL_MS = 30 * 60 * 1000;

const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[^\s]{10,}$/;

export const normalizeEmailAddress = (value) =>
  String(value ?? "").trim().toLowerCase();

export const isAllowedAccountEmail = (value) => {
  const email = normalizeEmailAddress(value);
  const domain = email.slice(email.lastIndexOf("@") + 1);

  return domain === "gmail.com"
    || domain.endsWith(".edu")
    || domain.endsWith(".edu.in")
    || domain.endsWith(".ac.in");
};

export const isStrongPassword = (value) =>
  typeof value === "string"
  && Buffer.byteLength(value, "utf8") <= PASSWORD_MAX_BYTES
  && PASSWORD_POLICY.test(value);

export const hashOpaqueToken = (value) =>
  crypto.createHash("sha256").update(String(value ?? "")).digest("hex");

export const hashVerificationToken = (value) =>
  hashOpaqueToken(value);

export const createOpaqueToken = () =>
  crypto.randomBytes(32).toString("hex");

export const createVerificationTokenPair = () => {
  const token = createOpaqueToken();

  return {
    token,
    tokenHash: hashVerificationToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  };
};

export const isJwtSecretStrong = (value) =>
  String(value ?? "").trim().length >= 32;
