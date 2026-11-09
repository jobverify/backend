import assert from "node:assert/strict";
import test from "node:test";

test('equivalent search URL spellings share the expensive-search quota', () => {
  for (const originalUrl of ['/api/jobs/', '/api/jobs/search/', '/API/JOBS/SEARCH', '/api/jobs/META/', '/api/jobs/meta/companies/']) {
    assert.equal(getApiRateLimitProfile({ method: 'GET', originalUrl }), 'expensive-search', originalUrl);
  }
});
import {
  createApiRateLimitHandler,
  createRateLimiter,
  getApiRateLimitProfile,
  isRateLimitingEnabled,
  isReadOnlyRequest,
} from "../src/utils/rateLimit.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  set(name, value) {
    this.headers[name] = String(value);
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = String(value);
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("rate limiting is disabled by default outside production", () => {
  assert.equal(isRateLimitingEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isRateLimitingEnabled({ NODE_ENV: "test" }), false);
});

test("rate limiting is enabled by default in production", () => {
  assert.equal(isRateLimitingEnabled({ NODE_ENV: "production" }), true);
});

test("rate limiting can be enabled locally but cannot be disabled in production", () => {
  assert.equal(
    isRateLimitingEnabled({
      NODE_ENV: "development",
      ENABLE_RATE_LIMITING: "true",
    }),
    true,
  );
  assert.equal(
    isRateLimitingEnabled({
      NODE_ENV: "production",
      ENABLE_RATE_LIMITING: "false",
    }),
    true,
  );
});

test("createRateLimiter returns pass-through middleware when disabled", () => {
  const middleware = createRateLimiter(
    {
      windowMs: 60_000,
      limit: 1,
    },
    { NODE_ENV: "development" },
  );

  let nextCalled = false;
  middleware({}, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("read-only helpers classify API traffic into separate limiter buckets", () => {
  assert.equal(isReadOnlyRequest({ method: "GET" }), true);
  assert.equal(isReadOnlyRequest({ method: "POST" }), false);

  assert.equal(
    getApiRateLimitProfile({ method: "POST", originalUrl: "/api/auth/login" }),
    "auth",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "GET", originalUrl: "/api/auth/csrf-token" }),
    "auth",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "GET", originalUrl: "/api/jobs?limit=12" }),
    "expensive-search",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "POST", originalUrl: "/api/jobs/search" }),
    "expensive-search",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "GET", originalUrl: "/api/jobs/meta/companies?query=ac" }),
    "expensive-search",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "GET", originalUrl: "/api/jobs/abc123" }),
    "cheap-read",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "PUT", originalUrl: "/api/user/profile" }),
    "mutation",
  );
  assert.equal(
    getApiRateLimitProfile({ method: "POST", originalUrl: "/api/billing/webhook" }),
    "skip",
  );
});

test("rate-limit handler emits the shared JSON contract with an explicit Retry-After", () => {
  const response = createResponse();

  createApiRateLimitHandler({
    message: "Too many requests",
    retryAfterSeconds: 900,
  })({}, response);

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "900");
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(response.body, {
    code: 429,
    error: "rate_limited",
    success: false,
    message: "Too many requests",
  });
});

test("rate-limit handler derives Retry-After from the limiter window when provided", () => {
  const response = createResponse();

  createApiRateLimitHandler({
    message: "Too many requests",
  })(
    {},
    response,
    undefined,
    { windowMs: 60_000 },
  );

  assert.equal(response.headers["Retry-After"], "60");
});

test("admin routes initialize when rate limiting is enabled", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableRateLimiting = process.env.ENABLE_RATE_LIMITING;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalConsoleError = console.error;
  const consoleErrors = [];

  process.env.NODE_ENV = "production";
  process.env.ENABLE_RATE_LIMITING = "true";
  process.env.JWT_SECRET = "12345678901234567890123456789012";
  console.error = (...args) => {
    consoleErrors.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    const moduleUrl = new URL(
      `../src/routes/adminRoutes.js?case=${Date.now()}`,
      import.meta.url,
    );
    const module = await import(moduleUrl.href);

    assert.equal(typeof module.default, "function");
    assert.equal(
      consoleErrors.some((message) => message.includes("ERR_ERL_KEY_GEN_IPV6")),
      false,
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENABLE_RATE_LIMITING = originalEnableRateLimiting;
    process.env.JWT_SECRET = originalJwtSecret;
    console.error = originalConsoleError;
  }
});
