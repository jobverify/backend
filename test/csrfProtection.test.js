import assert from "node:assert/strict";
import test from "node:test";
import {
  CSRF_COOKIE_NAME,
  getCsrfCookieOptions,
} from "../src/utils/csrf.js";
import { createCsrfProtection } from "../src/middleware/csrfProtection.js";

const createResponseDouble = () => {
  const result = {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.headersSent = true;
      this.body = payload;
      return this;
    },
  };

  return result;
};

test("csrf cookie is readable by the frontend and mirrors auth cookie security defaults", () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  const options = getCsrfCookieOptions();

  assert.equal(options.httpOnly, false);
  assert.equal(options.secure, false);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");

  process.env.NODE_ENV = originalEnv;
});

test("csrf protection ignores safe methods", () => {
  const middleware = createCsrfProtection({ allowedOrigins: ["https://app.jobverify.test"] });
  const res = createResponseDouble();
  let nextCalled = false;

  middleware(
    {
      method: "GET",
      originalUrl: "/api/jobs",
      headers: {},
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
  assert.equal(res.headersSent, false);
});

test("csrf protection rejects state-changing requests from untrusted origins", () => {
  const middleware = createCsrfProtection({ allowedOrigins: ["https://app.jobverify.test"] });
  const res = createResponseDouble();

  middleware(
    {
      method: "POST",
      originalUrl: "/api/user/profile",
      headers: {
        origin: "https://evil.example",
        cookie: `${CSRF_COOKIE_NAME}=csrf-token`,
        "x-csrf-token": "csrf-token",
      },
    },
    res,
    () => {},
  );

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /origin/i);
});

test("csrf protection accepts matching cookie and header values from an allowed origin", () => {
  const middleware = createCsrfProtection({ allowedOrigins: ["https://app.jobverify.test"] });
  const res = createResponseDouble();
  let nextCalled = false;

  middleware(
    {
      method: "POST",
      originalUrl: "/api/user/profile",
      headers: {
        origin: "https://app.jobverify.test",
        cookie: `${CSRF_COOKIE_NAME}=csrf-token`,
        "x-csrf-token": "csrf-token",
      },
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
  assert.equal(res.headersSent, false);
});

test("csrf protection accepts loopback development origins when enabled", () => {
  const middleware = createCsrfProtection({
    allowedOrigins: ["http://localhost:5173"],
    allowDevLoopback: true,
  });
  const res = createResponseDouble();
  let nextCalled = false;

  middleware(
    {
      method: "POST",
      originalUrl: "/api/user/profile",
      headers: {
        origin: "http://127.0.0.1:4173",
        cookie: `${CSRF_COOKIE_NAME}=csrf-token`,
        "x-csrf-token": "csrf-token",
      },
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
  assert.equal(res.headersSent, false);
});

test("csrf protection can exempt provider webhook paths from browser CSRF checks", () => {
  const middleware = createCsrfProtection({
    allowedOrigins: ["https://app.jobverify.test"],
    exemptPaths: ["/api/billing/webhook"],
  });
  const res = createResponseDouble();
  let nextCalled = false;

  middleware(
    {
      method: "POST",
      originalUrl: "/api/billing/webhook",
      headers: {},
    },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
  assert.equal(res.headersSent, false);
});
