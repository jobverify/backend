import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import * as controller from '../src/controllers/emailChangeController.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('email changes require a delivered, unexpired, single-use verification link', { timeout: 90000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  }, instance: { launchTimeout: 60000 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await User.init();
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@gmail.com' });
  let delivery;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { delivery = mail; return { messageId: 'test' }; } }));
  const password = 'ExistingPassword123!';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await User.create({ email: 'original@gmail.com', password: passwordHash, isVerified: true, sessionVersion: 2 });
  const request = async email => {
    const res = response();
    await controller.requestEmailChange({ user: await User.findById(user._id), body: { email, currentPassword: password } }, res);
    return res;
  };
  const verify = async token => {
    const res = response();
    await controller.verifyEmailChange({ body: { token } }, res);
    return res;
  };
  let token;
  await t.test('sends to the normalized new address and keeps the old address active', async () => {
    assert.equal((await request('  New.Address@GMAIL.com ')).statusCode, 200);
    assert.equal(delivery.to, 'new.address@gmail.com');
    const url = new URL(delivery.html.match(/href="([^"]+)"/)[1]);
    token = new URLSearchParams(url.hash.slice(1)).get('token');
    assert.equal(url.searchParams.get('mode'), 'change');
    const stored = await User.findById(user._id).select('+pendingEmailChange');
    assert.equal(stored.email, 'original@gmail.com');
    assert.equal(stored.pendingEmailChange.tokenHash, hashVerificationToken(token));
    assert.ok(!JSON.stringify(stored.toJSON()).includes(hashVerificationToken(token)));
    assert.equal((await request('another@gmail.com')).statusCode, 429);
  });
  await t.test('consumes the token atomically, clears reset links, and revokes old sessions', async () => {
    await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: 'old-reset', resetPasswordExpiresAt: new Date(Date.now() + 60000) } });
    const results = await Promise.all([verify(token), verify(token)]);
    assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 400]);
    const stored = await User.findById(user._id).select('+pendingEmailChange');
    assert.equal(stored.email, 'new.address@gmail.com');
    assert.equal(stored.sessionVersion, 3);
    assert.equal(stored.resetPasswordTokenHash, null);
    assert.equal(stored.pendingEmailChange, undefined);
    assert.equal(stored.password, passwordHash);
    assert.equal((await verify(token)).statusCode, 400);
  });
  await t.test('rejects expired links and addresses claimed before verification', async () => {
    await User.updateOne({ _id: user._id }, { $set: { pendingEmailChange: { email: 'taken@gmail.com', tokenHash: hashVerificationToken('expired'), expiresAt: new Date(0), requestedAt: new Date(0), sessionVersion: 3 } } });
    assert.equal((await verify('expired')).statusCode, 400);
    await User.create({ email: 'taken@gmail.com' });
    await User.updateOne({ _id: user._id }, { $set: { 'pendingEmailChange.expiresAt': new Date(Date.now() + 60000) } });
    assert.equal((await verify('expired')).statusCode, 400);
    assert.equal((await User.findById(user._id)).email, 'new.address@gmail.com');
  });
  await t.test('rejects invalid and unchanged addresses without exposing occupied addresses', async () => {
    const currentUser = await User.findById(user._id);
    for (const [email, expected] of [['bad', 400], ['new.address@gmail.com', 400], ['taken@gmail.com', 200]]) {
      const res = response();
      await controller.requestEmailChange({ user: currentUser, body: { email, currentPassword: password } }, res);
      assert.equal(res.statusCode, expected);
    }
  });
  await t.test('mail failures are reported and do not activate the new address', async t => {
    await User.updateOne({ _id: user._id }, { $unset: { pendingEmailChange: 1 } });
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw new Error('SMTP unavailable'); } }));
    assert.equal((await request('retry@gmail.com')).statusCode, 503);
    const stored = await User.findById(user._id).select('+pendingEmailChange');
    assert.equal(stored.email, 'new.address@gmail.com');
    assert.equal(stored.pendingEmailChange, undefined);
  });
  await t.test('resending invalidates the previous link and pending status exposes no secret', async () => {
    assert.equal((await request('resend@gmail.com')).statusCode, 200);
    const readToken = () => new URLSearchParams(new URL(delivery.html.match(/href="([^"]+)"/)[1]).hash.slice(1)).get('token');
    const oldToken = readToken();
    await User.updateOne({ _id: user._id }, { $set: { 'pendingEmailChange.requestedAt': new Date(0) } });
    assert.equal((await request('resend@gmail.com')).statusCode, 200);
    const status = response();
    await controller.getEmailChange({ user }, status);
    assert.equal(status.body.pendingEmail, 'resend@gmail.com');
    assert.equal(JSON.stringify(status.body).includes(readToken()), false);
    assert.equal((await verify(oldToken)).statusCode, 400);
    assert.equal((await verify(readToken())).statusCode, 200);
  });
  await t.test('a revoked session invalidates its pending email change', async () => {
    assert.equal((await request('revoked@gmail.com')).statusCode, 200);
    const token = new URLSearchParams(new URL(delivery.html.match(/href="([^"]+)"/)[1]).hash.slice(1)).get('token');
    await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
    assert.equal((await verify(token)).statusCode, 400);
    assert.equal((await User.findById(user._id)).email, 'resend@gmail.com');
  });
});

test('email change requests and status require authentication; verification uses POST', async () => {
  process.env.JWT_SECRET = 'email-change-tests-isolated-secret-at-least-32-characters';
  const { default: router } = await import('../src/routes/authRoutes.js');
  for (const path of ['/change-email', '/email-change']) {
    const route = router.stack.find(layer => layer.route?.path === path).route;
    assert.equal(route.stack[0].name, 'protect');
  }
  const verify = router.stack.find(layer => layer.route?.path === '/verify-email-change').route;
  assert.equal(verify.methods.post, true);
  assert.equal(verify.methods.get, undefined);
});
