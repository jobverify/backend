import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import User from '../src/models/User.js';
import { requestPasswordReset } from '../src/controllers/authController.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

function mockResetStorage(t, user) {
  t.mock.method(User, 'findOneAndUpdate', async (_filter, update) => { Object.assign(user, update.$set); return user; });
  t.mock.method(User, 'updateOne', async (_filter, update) => { Object.assign(user, update.$set); return { matchedCount: 1 }; });
}

test('profile reset waits for SMTP acceptance and uses the signed-in account', async t => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  Object.assign(process.env, { FRONTEND_ORIGIN: 'https://example.test', SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@example.test' });
  const user = new User({ email: 'owner@gmail.com' });
  mockResetStorage(t, user);
  t.mock.method(user, 'save', async () => user);
  t.mock.method(User, 'findOne', async () => user);
  let accept;
  const pending = new Promise(resolve => { accept = resolve; });
  let delivery;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => {
    delivery = mail;
    await pending;
    return { messageId: 'accepted' };
  } }));
  const res = response();
  const request = requestPasswordReset({ user, body: { email: 'other@gmail.com' } }, res);
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(res.body, null, 'must not report success while delivery is pending');
  } finally { accept(); await request; }
  assert.equal(delivery.to, 'owner@gmail.com');
  const link = new URL(delivery.html.match(/href="([^"]+)"/)[1]);
  assert.equal(link.origin, 'https://example.test');
  assert.equal(link.pathname, '/reset-password');
  const token = new URLSearchParams(link.hash.slice(1)).get('token');
  assert.equal(user.resetPasswordTokenHash, hashVerificationToken(token));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('profile SMTP failure returns a retryable error without exposing provider details', async t => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  Object.assign(process.env, { FRONTEND_ORIGIN: 'https://example.test', SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@example.test' });
  const user = new User({ email: 'owner@gmail.com' });
  mockResetStorage(t, user);
  t.mock.method(user, 'save', async () => user);
  t.mock.method(User, 'findOne', async () => user);
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => {
    throw new Error('private SMTP credentials rejected');
  } }));
  t.mock.method(console, 'error', () => {});
  const res = response();
  await requestPasswordReset({ user, body: { email: user.email } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /try again/i);
  assert.doesNotMatch(JSON.stringify(res.body), /private SMTP/);
});

test('profile reset route requires authentication before requesting mail', async () => {
  process.env.JWT_SECRET ||= 'profile-reset-isolated-test-secret-at-least-32-characters';
  const { default: router } = await import('../src/routes/authRoutes.js');
  const route = router.stack.find(layer => layer.route?.path === '/send-reset-email')?.route;
  assert.ok(route);
  assert.equal(route.methods.post, true);
  assert.equal(route.stack[0].name, 'protect');
});

test('public recovery keeps its generic response independent of SMTP completion', async t => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  Object.assign(process.env, { FRONTEND_ORIGIN: 'https://example.test', SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@example.test' });
  const user = new User({ email: 'owner@gmail.com' });
  mockResetStorage(t, user);
  t.mock.method(user, 'save', async () => user);
  t.mock.method(User, 'findOne', async () => user);
  let rejectDelivery;
  const delivery = new Promise((resolve, reject) => { rejectDelivery = reject; });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: () => delivery }));
  t.mock.method(console, 'error', () => {});
  const res = response();
  const request = requestPasswordReset({ body: { email: user.email } }, res);
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(res.body?.success, true, 'public response must not depend on SMTP timing');
    assert.equal(res.body.message, 'If an account exists for this email, a password reset link will be sent.');
  } finally { rejectDelivery(new Error('SMTP unavailable')); await request; await new Promise(resolve => setImmediate(resolve)); }
});
