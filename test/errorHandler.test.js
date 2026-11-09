import assert from "node:assert/strict";
import test from "node:test";
import { APIError, errorHandler } from "../src/middleware/errorHandler.js";

test("errorHandler delegates errors after response headers have been sent", () => {
  const error = new Error("stream interrupted");
  let delegated;
  errorHandler(error, {}, { headersSent: true }, (value) => { delegated = value; });
  assert.equal(delegated, error);
});

test("errorHandler normalizes invalid HTTP statuses to an internal error", () => {
  let status;
  const res = {
    status(value) { status = value; return this; },
    json() { return this; },
  };
  errorHandler(Object.assign(new Error("bad status"), { statusCode: 999 }), {}, res, () => {});
  assert.equal(status, 500);
});

const createResponseDouble = () => {
  const result = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return result;
};

test("errorHandler hides raw message details in production for unexpected errors", () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const res = createResponseDouble();
  errorHandler(new Error("database exploded"), {}, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Internal Server Error");
  assert.equal("details" in res.body, false);

  process.env.NODE_ENV = originalEnv;
});

test("errorHandler preserves explicit APIError messages", () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const res = createResponseDouble();
  errorHandler(new APIError(403, "Forbidden action"), {}, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Forbidden action");

  process.env.NODE_ENV = originalEnv;
});

test("invalid JSON responses and logs do not echo submitted credentials", (t) => {
  const logs = [];
  t.mock.method(console, "error", (...values) => logs.push(values));
  const res = createResponseDouble();
  const error = Object.assign(new SyntaxError('Unexpected token in "private-password"'), {
    status: 400,
    type: "entity.parse.failed",
    body: '{"password":"private-password"',
  });
  errorHandler(error, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Invalid JSON request body.");
  assert.doesNotMatch(JSON.stringify([res.body, logs]), /private-password/);
});
