import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import mongoose from "mongoose";

const env = {
  NODE_ENV: "test",
  PAYMENT_PROVIDER: "razorpay",
  RAZORPAY_WEBHOOK_SECRET: "local-webhook-test-secret",
  JWT_SECRET: "local-tests-only-secret-at-least-32-characters",
  CORS_ORIGIN: "https://app.jobverify.test",
};

Object.assign(process.env, env);
const { createApp } = await import("../src/app.js");
const { default: jwt } = await import("jsonwebtoken");
const { default: User } = await import("../src/models/User.js");
const { default: BlacklistedToken } = await import("../src/models/BlacklistedToken.js");

async function withApp(run) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`, app);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('production startup refuses incomplete CAPTCHA configuration', () => {
  const keys = ['NODE_ENV', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_ALLOWED_HOSTNAMES', 'TURNSTILE_EXPECTED_ACTION'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'local-fixture-secret', TURNSTILE_ALLOWED_HOSTNAMES: 'www.jobverify.test', TURNSTILE_EXPECTED_ACTION: 'login' });
    for (const key of keys.slice(1)) {
      const configured = process.env[key];
      delete process.env[key];
      assert.throws(() => createApp(), new RegExp(key));
      process.env[key] = configured;
    }
    assert.doesNotThrow(() => createApp());
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("constructing the app does not connect the database; health and API misses return JSON", async () => {
  await withApp(async (base) => {
    assert.equal(mongoose.connection.readyState, 0);
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");
    assert.equal(health.headers.get("x-powered-by"), null);
    const missing = await fetch(`${base}/api/not-a-route`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).success, false);
    assert.equal(missing.headers.get("cache-control"), "no-store");
  });
});

test("readiness reports unavailable while the database is disconnected", async () => {
  await withApp(async (base) => {
    const ready = await fetch(`${base}/ready`);
    assert.equal(ready.status, 503);
    assert.equal(ready.headers.get("cache-control"), "no-store");
    assert.equal((await ready.json()).status, "unavailable");
  });
});

test("retired billing referral endpoints return the normal API not-found response", async () => {
  const originalUserFindById = User.findById;
  const originalBlacklistFindOne = BlacklistedToken.findOne;
  const authToken = jwt.sign({ id: "user-1", sessionVersion: 0 }, env.JWT_SECRET);
  const user = {
    _id: "user-1",
    accessRole: "free_user",
    sessionVersion: 0,
    deactivated: false,
    premium: { planId: "free", status: "inactive", expiresAt: null },
  };
  User.findById = () => ({ select: async () => user });
  BlacklistedToken.findOne = async () => null;

  try {
    await withApp(async (base) => {
      const authorization = `Bearer ${authToken}`;
      const statusResponse = await fetch(`${base}/api/billing/referrals/me`, {
        headers: { authorization },
      });
      assert.equal(statusResponse.status, 404);
      await statusResponse.json();

      const csrfResponse = await fetch(`${base}/api/auth/csrf-token`);
      const { token } = await csrfResponse.json();
      const cookie = csrfResponse.headers.get("set-cookie").split(";", 1)[0];
      const createResponse = await fetch(`${base}/api/billing/referrals/code`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json",
          origin: env.CORS_ORIGIN,
          "x-csrf-token": token,
          cookie,
        },
        body: "{}",
      });
      assert.equal(createResponse.status, 404);
      await createResponse.json();
    });
  } finally {
    User.findById = originalUserFindById;
    BlacklistedToken.findOne = originalBlacklistFindOne;
  }
});

test("the real middleware rejects JSON lookalike content types and malformed JSON", async () => {
  await withApp(async (base) => {
    const invalidType = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/jsonp" }, body: "{}",
    });
    assert.equal(invalidType.status, 415);
    const malformed = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).success, false);
  });
});

test("CORS preflight supports PATCH for allowed origins without authorizing other origins", async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/api/user/profile`, {
      method: "OPTIONS",
      headers: { origin: env.CORS_ORIGIN, "access-control-request-method": "PATCH" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), env.CORS_ORIGIN);
    assert.match(response.headers.get("access-control-allow-methods"), /PATCH/);
    const denied = await fetch(`${base}/health`, { headers: { origin: "https://other.test" } });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  });
});

test("allowed browser clients can read the filename of a downloaded document", async () => {
  await withApp(async (base, app) => {
    app.get('/download-filename-probe', (_req, res) => {
      res.attachment('jobverify-cv.pdf').send('document fixture');
    });
    const response = await fetch(`${base}/download-filename-probe`, {
      headers: { origin: env.CORS_ORIGIN },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), env.CORS_ORIGIN);
    assert.match(response.headers.get('content-disposition'), /jobverify-cv\.pdf/);
    assert.match(response.headers.get('access-control-expose-headers') || '', /\bContent-Disposition\b/i);
    assert.equal(await response.text(), 'document fixture');
  });
});


test("signed webhooks preserve exact JSON bytes with a query string", async () => {
  await withApp(async (base) => {
    // This event is acknowledged without database or external payment calls.
    const body = '{ "event" : "test.ignored", "payload": {} }';
    const signature = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(body).digest("hex");
    const send = (payload) => fetch(base + "/api/billing/webhook?delivery=retry", {
      method: "POST",
      headers: { "content-type": "application/json", "x-razorpay-signature": signature },
      body: payload,
    });
    const accepted = await send(body);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).success, true);
    const tampered = await send(body + " ");
    assert.equal(tampered.status, 400);
    assert.equal((await tampered.json()).success, false);
  });
});
