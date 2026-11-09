import assert from 'node:assert/strict';
import test from 'node:test';
import { requireTurnstileCaptcha } from '../src/middleware/turnstileCaptcha.js';

async function check(env, token = '') {
  let nextCalled = false;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await requireTurnstileCaptcha({ env })({ body: { turnstileToken: token } }, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('production CAPTCHA never silently bypasses missing configuration', async () => {
  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'dummy' },
    { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'dummy', TURNSTILE_ALLOWED_HOSTNAMES: 'www.example.com' },
  ]) {
    const { res, nextCalled } = await check(env);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
  }
});

test('unconfigured local CAPTCHA remains optional', async () => {
  assert.equal((await check({ NODE_ENV: 'test' })).nextCalled, true);
});

test('configured production CAPTCHA rejects missing tokens before network access', async () => {
  const { res, nextCalled } = await check({ NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'dummy', TURNSTILE_ALLOWED_HOSTNAMES: 'www.example.com', TURNSTILE_EXPECTED_ACTION: 'login' });
  assert.equal(res.statusCode, 400);
  assert.equal(nextCalled, false);
});
