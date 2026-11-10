import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import { sendPasswordResetEmail, sendVerificationEmail } from '../src/utils/sendEmail.js';
import User from '../src/models/User.js';
import { requestPasswordReset } from '../src/controllers/authController.js';

const secret = 'relay-test-secret-with-at-least-32-characters';
const resetLink = `https://jobverify.test/reset-password#token=${'a'.repeat(64)}`;

function relayEnvironment(t, overrides = {}) {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  Object.assign(process.env, {
    EMAIL_RELAY_URL: 'https://mail-relay.example.workers.dev',
    EMAIL_RELAY_SECRET: secret,
    SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '',
    ...overrides,
  });
  t.mock.method(console, 'log', () => {});
}

test('registration verification uses the authenticated relay without SMTP', async t => {
  relayEnvironment(t);
  t.mock.method(nodemailer, 'createTransport', () => assert.fail('verification must use relay'));
  const verificationLink = `https://jobverify.test/verify-email#token=${'b'.repeat(64)}`;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mail-relay.example.workers.dev/send-verification');
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { to: 'owner@gmail.com', verificationLink });
    return Response.json({ success: true });
  });
  assert.deepEqual(await sendVerificationEmail('owner@gmail.com', verificationLink), { accepted: ['owner@gmail.com'] });
});

test('verification relay failure stays safe and never falls back to SMTP', async t => {
  relayEnvironment(t);
  t.mock.method(nodemailer, 'createTransport', () => assert.fail('must not fall back to SMTP'));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'private details' }, { status: 503 }));
  await assert.rejects(sendVerificationEmail('owner@gmail.com', 'https://jobverify.test/verify-email'),
    { message: 'Verification email relay delivery failed.' });
});

test('verification retains direct SMTP when the relay is not configured', async t => {
  relayEnvironment(t, {
    EMAIL_RELAY_URL: '', SMTP_HOST: '127.0.0.1', SMTP_PORT: '465', SMTP_SECURE: 'true',
    SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'test-password', SMTP_FROM: 'sender@gmail.com',
  });
  t.mock.method(globalThis, 'fetch', () => assert.fail('direct SMTP must not call relay'));
  const verificationLink = `https://jobverify.test/verify-email#token=${'b'.repeat(64)}`;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => {
    assert.equal(mail.to, 'owner@gmail.com');
    assert.equal(mail.subject, 'Verify your Jobverify account');
    assert.ok(mail.html.includes(verificationLink));
    return { accepted: [mail.to] };
  } }));
  assert.deepEqual(await sendVerificationEmail('owner@gmail.com', verificationLink), { accepted: ['owner@gmail.com'] });
});

test('verification rejects missing relay credentials before network access', async t => {
  relayEnvironment(t, { EMAIL_RELAY_SECRET: '' });
  t.mock.method(globalThis, 'fetch', () => assert.fail('invalid config must not call relay'));
  await assert.rejects(sendVerificationEmail('owner@gmail.com', 'https://jobverify.test/verify-email'),
    { message: 'Invalid verification email relay configuration.' });
});

test('password-reset relay uses authenticated HTTPS and waits for acceptance without SMTP configuration', async t => {
  relayEnvironment(t);
  t.mock.method(nodemailer, 'createTransport', () => assert.fail('relay must not connect to SMTP'));
  let request;
  let accept;
  const pending = new Promise(resolve => { accept = resolve; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, options };
    await pending;
    return Response.json({ success: true });
  });
  let settled = false;
  const delivery = sendPasswordResetEmail('owner@gmail.com', resetLink).then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(settled, false);
    assert.equal(request.url, 'https://mail-relay.example.workers.dev/send-password-reset');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(request.options.redirect, 'error');
    assert.ok(request.options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(request.options.body), { to: 'owner@gmail.com', resetLink });
  } finally { accept(); await delivery; }
});

for (const [name, url, relaySecret] of [
  ['insecure URL', 'http://mail-relay.example.workers.dev', secret],
  ['URL containing credentials', 'https://user:pass@mail-relay.example.workers.dev', secret],
  ['URL containing a query', 'https://mail-relay.example.workers.dev?secret=example', secret],
  ['URL containing a path', 'https://mail-relay.example.workers.dev/other', secret],
  ['missing secret', 'https://mail-relay.example.workers.dev', ''],
  ['short secret', 'https://mail-relay.example.workers.dev', 'short'],
]) {
  test(`password-reset relay rejects ${name} before network access`, async t => {
    relayEnvironment(t, { EMAIL_RELAY_URL: url, EMAIL_RELAY_SECRET: relaySecret });
    t.mock.method(globalThis, 'fetch', () => assert.fail('invalid configuration must not make requests'));
    await assert.rejects(sendPasswordResetEmail('owner@gmail.com', resetLink), /relay configuration/i);
  });
}

test('relay request has a 30-second deadline and surfaces an abort as a safe error', async t => {
  relayEnvironment(t);
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 30_000);
    return AbortSignal.abort();
  });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => { signal.throwIfAborted(); });
  await assert.rejects(sendPasswordResetEmail('owner@gmail.com', resetLink), /relay delivery failed/);
});

test('an authenticated relay failure clears only its reserved token and returns a retryable error', async t => {
  relayEnvironment(t, { FRONTEND_ORIGIN: 'https://jobverify.test' });
  const user = new User({ email: 'owner@gmail.com' });
  let reservedHash;
  let cleanupFilter;
  t.mock.method(User, 'findOneAndUpdate', async (_filter, update) => {
    reservedHash = update.$set.resetPasswordTokenHash;
    Object.assign(user, update.$set);
    return user;
  });
  t.mock.method(User, 'updateOne', async (filter, update) => {
    cleanupFilter = filter;
    Object.assign(user, update.$set);
    return { matchedCount: 1 };
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false }, { status: 503 }));
  t.mock.method(console, 'error', () => {});
  const response = { statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await requestPasswordReset({ user, body: {} }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /try again/i);
  assert.equal(cleanupFilter.resetPasswordTokenHash, reservedHash);
  assert.equal(user.resetPasswordTokenHash, null);
  assert.equal(user.resetPasswordExpiresAt, null);
});

for (const [name, result] of [
  ['upstream failure', () => Response.json({ message: 'private provider details' }, { status: 503 })],
  ['malformed success', () => new Response('private provider details')],
  ['false success', () => Response.json({ success: false })],
  ['network failure or timeout', () => { throw new Error(`private credentials ${secret}`); }],
]) {
  test(`password-reset relay propagates ${name} as a safe delivery error`, async t => {
    relayEnvironment(t);
    t.mock.method(globalThis, 'fetch', result);
    t.mock.method(nodemailer, 'createTransport', () => assert.fail('must not fall back to SMTP'));
    await assert.rejects(sendPasswordResetEmail('owner@gmail.com', resetLink), error => {
      assert.equal(error.message, 'Password reset email relay delivery failed.');
      return true;
    });
  });
}
