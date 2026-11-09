import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getRequestAuthToken,
} from "../src/utils/authCookies.js";
import {
  createVerificationTokenPair,
  hashVerificationToken,
  isStrongPassword,
  normalizeEmailAddress,
} from "../src/utils/authSecurity.js";

test("getRequestAuthToken prefers bearer authorization over cookies", () => {
  const req = {
    headers: {
      authorization: "Bearer bearer-token",
      cookie: `${AUTH_COOKIE_NAME}=cookie-token`,
    },
  };

  assert.equal(getRequestAuthToken(req), "bearer-token");
});

test("getRequestAuthToken reads encoded auth cookie when bearer token is absent", () => {
  const req = {
    headers: {
      cookie: `other=value; ${AUTH_COOKIE_NAME}=cookie%20token`,
    },
  };

  assert.equal(getRequestAuthToken(req), "cookie token");
});

test("auth cookie defaults are httpOnly and sameSite lax outside production", () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  const options = getAuthCookieOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, false);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, 7 * 24 * 60 * 60 * 1000);

  process.env.NODE_ENV = originalEnv;
});

test("normalizeEmailAddress trims and lowercases emails", () => {
  assert.equal(
    normalizeEmailAddress("  Student.User+jobs@Example.COM  "),
    "student.user+jobs@example.com",
  );
});

test("isStrongPassword accepts long mixed-character passwords", () => {
  assert.equal(isStrongPassword("Password123!"), true);
  assert.equal(isStrongPassword("short1!"), false);
  assert.equal(isStrongPassword("alllowercase123!"), false);
  assert.equal(isStrongPassword("ALLUPPERCASE123!"), false);
  assert.equal(isStrongPassword("MissingNumber!"), false);
});

test("hashVerificationToken is deterministic and does not echo the raw token", () => {
  const rawToken = "plain-verification-token";
  const tokenHash = hashVerificationToken(rawToken);

  assert.equal(tokenHash, hashVerificationToken(rawToken));
  assert.notEqual(tokenHash, rawToken);
});

test("createVerificationTokenPair returns a raw token plus a stored hash", () => {
  const pair = createVerificationTokenPair();

  assert.equal(typeof pair.token, "string");
  assert.equal(pair.token.length > 20, true);
  assert.equal(pair.tokenHash, hashVerificationToken(pair.token));
});

test("auth routes keep logout protected and split verify-email GET and POST handlers", async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalFrontendOrigin = process.env.FRONTEND_ORIGIN;

  process.env.JWT_SECRET = originalJwtSecret || "x".repeat(32);
  process.env.FRONTEND_ORIGIN = originalFrontendOrigin || "http://localhost:5173";

  try {
    const { default: router } = await import("../src/routes/authRoutes.js");

    const logoutLayer = router.stack.find(
      (layer) => layer.route?.path === "/logout" && layer.route.methods.post,
    );
    assert.ok(logoutLayer);
    assert.equal(logoutLayer.route.stack[0].name, "protectLogout");
    assert.equal(logoutLayer.route.stack.at(-1).name, "logout");

    const verifyGetLayer = router.stack.find(
      (layer) => layer.route?.path === "/verify-email" && layer.route.methods.get,
    );
    assert.ok(verifyGetLayer);
    assert.equal(verifyGetLayer.route.stack.at(-1).name, "redirectVerifyEmail");

    const verifyPostLayer = router.stack.find(
      (layer) => layer.route?.path === "/verify-email" && layer.route.methods.post,
    );
    assert.ok(verifyPostLayer);
    assert.equal(verifyPostLayer.route.stack.at(-1).name, "verifyEmail");

    const forgotPasswordLayer = router.stack.find(
      (layer) => layer.route?.path === "/forgot-password" && layer.route.methods.post,
    );
    assert.ok(forgotPasswordLayer);
    assert.equal(forgotPasswordLayer.route.stack.at(-1).name, "requestPasswordReset");

    const resetPasswordLayer = router.stack.find(
      (layer) => layer.route?.path === "/reset-password" && layer.route.methods.post,
    );
    assert.ok(resetPasswordLayer);
    assert.equal(resetPasswordLayer.route.stack.at(-1).name, "resetPassword");

    const loginLayer = router.stack.find(
      (layer) => layer.route?.path === "/login" && layer.route.methods.post,
    );
    assert.ok(loginLayer);
    assert.equal(loginLayer.route.stack.length, 6);
    assert.equal(loginLayer.route.stack.at(-1).name, "login");

    const googleLayer = router.stack.find(
      (layer) => layer.route?.path === "/google" && layer.route.methods.post,
    );
    assert.ok(googleLayer);
    assert.equal(googleLayer.route.stack.at(-1).name, "authenticateWithGoogle");
  } finally {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.FRONTEND_ORIGIN = originalFrontendOrigin;
  }
});
