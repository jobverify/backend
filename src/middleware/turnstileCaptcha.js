const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 5000;

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeToken = (req) => {
  const token =
    req.body?.turnstileToken
    ?? req.body?.captchaToken
    ?? req.body?.["cf-turnstile-response"];

  return typeof token === "string" ? token.trim() : "";
};

const isTurnstileEnabled = (env = process.env) =>
  Boolean(String(env.TURNSTILE_SECRET_KEY || "").trim());

export function validateTurnstileConfiguration(env = process.env) {
  if (String(env.NODE_ENV || '').trim().toLowerCase() !== 'production') return;
  for (const key of ['TURNSTILE_SECRET_KEY', 'TURNSTILE_ALLOWED_HOSTNAMES', 'TURNSTILE_EXPECTED_ACTION']) {
    if (!String(env[key] || '').trim() || (key === 'TURNSTILE_ALLOWED_HOSTNAMES' && parseList(env[key]).length === 0)) {
      throw new Error(`${key} must be configured in production.`);
    }
  }
}

const validateTurnstileResponse = (result, options) => {
  if (!result?.success) {
    return false;
  }

  if (options.expectedAction && result.action !== options.expectedAction) {
    return false;
  }

  if (
    options.allowedHostnames.length > 0
    && !options.allowedHostnames.includes(result.hostname)
  ) {
    return false;
  }

  return true;
};

export const requireTurnstileCaptcha = (options = {}) => async (req, res, next) => {
  const env = options.env ?? process.env;
  const secret = String(env.TURNSTILE_SECRET_KEY || "").trim();

  try {
    validateTurnstileConfiguration(env);
  } catch {
    return res.status(503).json({ code: 503, success: false, message: 'Security verification is temporarily unavailable. Please try again.' });
  }

  if (!isTurnstileEnabled(env)) {
    return next();
  }

  const token = normalizeToken(req);
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: "Security verification is required. Please try again.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: req.ip,
      }),
    });

    const result = await response.json().catch(() => null);
    const isValid = response.ok && validateTurnstileResponse(result, {
      allowedHostnames: parseList(env.TURNSTILE_ALLOWED_HOSTNAMES),
      expectedAction: String(env.TURNSTILE_EXPECTED_ACTION || "").trim(),
    });

    if (!isValid) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Security verification failed. Please try again.",
      });
    }

    return next();
  } catch (err) {
    console.error("Turnstile verification failed:", err.message);
    return res.status(503).json({
      code: 503,
      success: false,
      message: "Security verification is temporarily unavailable. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
};
