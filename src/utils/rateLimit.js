import rateLimit, { ipKeyGenerator, MemoryStore } from "express-rate-limit";
import { createHash } from 'node:crypto';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';
import { hasPublishingCredential, isTrustedPublishingRequest, isTrustedPublicBudgetRequest } from './publishingAccess.js';

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXPENSIVE_JOB_READ_PATHS = new Set([
  "/api/jobs",
  "/api/jobs/search",
  "/api/jobs/meta",
  "/api/jobs/meta/companies",
]);

const normalizeEnvValue = (value) => String(value ?? "").trim().toLowerCase();
const normalizeMethod = (value) => String(value ?? "").trim().toUpperCase();

// Match Express's default case-insensitive, non-strict routing policy.
export const getRequestPath = (req = {}) => String(req.originalUrl ?? req.url ?? "")
  .split("?")[0].toLowerCase().replace(/\/+$/, '') || '/';

export const isReadOnlyRequest = (req = {}) => READ_ONLY_METHODS.has(normalizeMethod(req.method));

export const getApiRateLimitProfile = (req = {}) => {
  const path = getRequestPath(req);

  // Server-rendered public pages share a frontend egress IP. Authenticate that
  // narrow read path instead of charging all visitors to one visitor's quota.
  if (isTrustedPublishingRequest(req)) return 'publishing-render';
  if (isTrustedPublicBudgetRequest(req)) return 'publishing-budget';

  if (
    path === "/api/billing/webhook"
    || path === "/api/integrations/telegram/webhook"
  ) {
    return "skip";
  }

  if (path.startsWith("/api/auth")) {
    return "auth";
  }

  if (path === '/api/publishing/build-feed' && isReadOnlyRequest(req)) {
    if (['GET', 'HEAD'].includes(normalizeMethod(req.method)) && hasPublishingCredential(req)) return 'publishing-build';
    return 'publishing';
  }

  if (EXPENSIVE_JOB_READ_PATHS.has(path)) {
    return "expensive-search";
  }

  if (isReadOnlyRequest(req)) {
    return "cheap-read";
  }

  return "mutation";
};

export const isRateLimitingEnabled = (env = process.env) => {
  if (normalizeEnvValue(env.NODE_ENV) === "production") return true;
  const explicitValue = normalizeEnvValue(env.ENABLE_RATE_LIMITING);
  if (TRUE_VALUES.has(explicitValue)) return true;
  if (FALSE_VALUES.has(explicitValue)) return false;

  return normalizeEnvValue(env.NODE_ENV) === "production";
};

const setHeader = (res, name, value) => {
  if (typeof res?.set === "function") {
    res.set(name, value);
    return;
  }

  if (typeof res?.setHeader === "function") {
    res.setHeader(name, value);
  }
};

export const createApiRateLimitHandler = (config) => {
  const normalizedConfig = typeof config === "string"
    ? { message: config }
    : { ...(config ?? {}) };

  return (req, res, _next, options = {}) => {
    const now = Date.now();
    const resetTimeMs = req?.rateLimit?.resetTime instanceof Date
      ? req.rateLimit.resetTime.getTime() - now
      : null;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (
          Number.isFinite(normalizedConfig.retryAfterSeconds)
            ? normalizedConfig.retryAfterSeconds * 1000
            : Number.isFinite(resetTimeMs) && resetTimeMs > 0
              ? resetTimeMs
              : Number(options?.windowMs ?? 15 * 60 * 1000)
        ) / 1000,
      ),
    );

    setHeader(res, "Retry-After", String(retryAfterSeconds));
    setHeader(res, "Cache-Control", "no-store");

    return res.status(429).json({
      code: 429,
      error: "rate_limited",
      success: false,
      message: String(normalizedConfig.message ?? "Too many requests"),
    });
  };
};

export const createRateLimiter = (options, env = process.env) => {
  if (!isRateLimitingEnabled(env)) {
    return (_req, _res, next) => next();
  }

  const { storePrefix, ...limiterOptions } = options;
  if (normalizeEnvValue(env.NODE_ENV) === 'production') {
    // Identical policies intentionally share a budget across replicas. Functions
    // are included so different skip/key policies do not collide.
    const prefix = storePrefix || createHash('sha256').update(JSON.stringify(
      limiterOptions, (_key, value) => typeof value === 'function' ? value.toString() : value,
    )).digest('hex');
    limiterOptions.store ||= new MongoRateLimitStore({ prefix });
    limiterOptions.passOnStoreError = false;
  }
  return rateLimit(limiterOptions);
};

// Local load shedding must work before parsing, authentication, or database
// readiness. More specific production quotas below it use the shared store.
export const createIngressRateLimiter = (env = process.env, { limit = 1200 } = {}) => createRateLimiter({
  storePrefix: 'ingress', windowMs: 60_000, limit, store: new MemoryStore(),
  standardHeaders: true, legacyHeaders: false,
  handler: createApiRateLimitHandler({ message: 'Too many requests. Please try again shortly.' }),
}, env);

export const createPublishingRenderRateLimiter = (env = process.env) => createRateLimiter({
  storePrefix: 'publishing-render', windowMs: 15 * 60_000, limit: 3000,
  skip: req => getApiRateLimitProfile(req) !== 'publishing-render',
  standardHeaders: true, legacyHeaders: false,
  handler: createApiRateLimitHandler({ message: 'Too many page rendering requests. Please try again shortly.' }),
}, env);

export const createPublishingBudgetRateLimiter = (env = process.env) => createRateLimiter({
  storePrefix: 'publishing-budget', windowMs: 15 * 60_000, limit: 6000,
  skip: req => getApiRateLimitProfile(req) !== 'publishing-budget',
  standardHeaders: true, legacyHeaders: false,
  handler: createApiRateLimitHandler({ message: 'Too many public request budget checks. Please retry shortly.' }),
}, env);

// A build may paginate up to 500 times. Keep that traffic out of the search
// quota, with room for retries while still bounding public feed requests.
export const createPublishingRateLimiter = (env = process.env) => createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  skip: req => getApiRateLimitProfile(req) !== 'publishing',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createApiRateLimitHandler({ message: 'Too many publishing feed requests from this IP' }),
}, env);

// Isolate authenticated deployments from public feed readers and page rendering.
// Allow two overlapping 500-page builds with up to three attempts per page.
export const createPublishingBuildRateLimiter = (env = process.env) => createRateLimiter({
  storePrefix: 'publishing-build', windowMs: 15 * 60_000, limit: 3000,
  skip: req => getApiRateLimitProfile(req) !== 'publishing-build',
  standardHeaders: true, legacyHeaders: false,
  handler: createApiRateLimitHandler({ message: 'Too many authenticated publishing build requests from this IP' }),
}, env);

export { ipKeyGenerator };
