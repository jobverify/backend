import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import { register, verifyEmail, resendVerification } from '../src/controllers/authController.js';
import { requestEmailChange, verifyEmailChange } from '../src/controllers/emailChangeController.js';
import { googleIdentity } from '../src/utils/googleAuth.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';
import { registerValidation, verifyEmailValidation } from '../src/validation/requestValidators.js';

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  cookie() {}, clearCookie() {},
});
async function invoke(handler, body, user, rules = []) {
  const req = { body, user }; const res = response();
  for (const rule of rules) await rule.run(req);
  await handler(req, res); return res;
}

test('account security boundaries', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@gmail.com' });
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }], binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), PendingUser.init()]);
  const mails = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { mails.push(mail); return { messageId: 'test' }; } }));
  const password = 'MailboxOwnerPassword123!';
  const attackerPassword = 'AttackerChosenPassword123!';

  await t.test('registration does not store credentials before email ownership is established', async () => {
    const email = 'fresh-registration@gmail.com';
    const res = await invoke(register, { name: 'Candidate', email }, undefined, registerValidation);
    assert.equal(res.statusCode, 201);
    assert.equal((await PendingUser.findOne({ email })).password, null);
  });

  await t.test('verification requires a new password even for legacy pending accounts', async () => {
    const email = 'legacy-pending@gmail.com'; const token = 'legacy-private-token';
    await PendingUser.create({ email, password: await bcrypt.hash(attackerPassword, 4), profile: { name: 'Candidate' },
      verificationTokenHash: hashVerificationToken(token), verificationTokenExpiresAt: new Date(Date.now() + 60000) });
    const missing = await invoke(verifyEmail, { token }, undefined, verifyEmailValidation);
    assert.equal(missing.statusCode, 400);
    assert.equal(await User.exists({ email }), null);
    const verified = await invoke(verifyEmail, { token, password }, undefined, verifyEmailValidation);
    assert.equal(verified.statusCode, 200);
    const user = await User.findOne({ email });
    assert.equal(await bcrypt.compare(password, user.password), true);
    assert.equal(await bcrypt.compare(attackerPassword, user.password), false);
    assert.equal((await invoke(verifyEmail, { token, password }, undefined, verifyEmailValidation)).statusCode, 400);
  });

  await t.test('a concurrent resend during password hashing invalidates the older verification token', async t => {
    const email = 'rotated-verification@gmail.com'; const token = 'old-verification-token';
    const pending = await PendingUser.create({ email, password: await bcrypt.hash(attackerPassword, 4), profile: { name: 'Candidate' },
      verificationTokenHash: hashVerificationToken(token), verificationTokenExpiresAt: new Date(Date.now() + 60000) });
    const hash = bcrypt.hash.bind(bcrypt);
    t.mock.method(bcrypt, 'hash', async (...args) => {
      await PendingUser.updateOne({ _id: pending._id }, { $set: { verificationTokenHash: hashVerificationToken('new-token') } });
      return hash(...args);
    });
    assert.equal((await invoke(verifyEmail, { token, password }, undefined, verifyEmailValidation)).statusCode, 400);
    assert.equal(await User.exists({ email }), null);
    assert.ok(await PendingUser.exists({ email }));
  });

  const user = await User.create({ email: 'current-owner@gmail.com', password: await bcrypt.hash(password, 4), isVerified: true, sessionVersion: 2 });
  await t.test('a session alone or a wrong password cannot request an email change', async () => {
    for (const proof of [{}, { currentPassword: 'wrong-password' }]) {
      assert.equal((await invoke(requestEmailChange, { email: 'new-owner@gmail.com', ...proof }, user)).statusCode, 403);
    }
    assert.equal((await User.findById(user._id).select('+pendingEmailChange')).pendingEmailChange, undefined);
  });

  await t.test('the current password authorizes a change', async () => {
    assert.equal((await invoke(requestEmailChange, { email: 'new-owner@gmail.com', currentPassword: password }, user)).statusCode, 200);
    assert.equal((await User.findById(user._id).select('+pendingEmailChange')).pendingEmailChange.email, 'new-owner@gmail.com');
  });

  await t.test('reauthentication cannot race a session revocation', async t => {
    await User.updateOne({ _id: user._id }, { $unset: { pendingEmailChange: 1 } });
    const compare = bcrypt.compare.bind(bcrypt);
    t.mock.method(bcrypt, 'compare', async (...args) => {
      await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
      return compare(...args);
    });
    const result = await invoke(requestEmailChange, { email: 'raced-owner@gmail.com', currentPassword: password }, user);
    assert.ok(result.statusCode >= 400);
    assert.equal((await User.findById(user._id).select('+pendingEmailChange')).pendingEmailChange, undefined);
  });

  await t.test('Google reauthentication requires the linked identity and a recent credential', async t => {
    const oauth = await User.create({ email: 'google-owner@gmail.com', google: { sub: 'linked-subject' } });
    for (const identity of [
      { sub: 'other-subject', issuedAt: Math.floor(Date.now() / 1000) },
      { sub: 'linked-subject', issuedAt: Math.floor(Date.now() / 1000) - 3600 },
      { sub: 'linked-subject' },
    ]) {
      const mock = t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email: oauth.email, emailVerified: true, ...identity }));
      assert.equal((await invoke(requestEmailChange, { email: 'oauth-new@gmail.com', credential: 'fixture' }, oauth)).statusCode, 403);
      mock.mock.restore();
    }
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email: oauth.email, emailVerified: true, sub: 'linked-subject', issuedAt: Math.floor(Date.now() / 1000) }));
    assert.equal((await invoke(requestEmailChange, { email: 'oauth-new@gmail.com', credential: 'fixture' }, oauth)).statusCode, 200);
  });

  await t.test('occupied and free destination addresses return the same public contract', async () => {
    const actor = await User.create({ email: 'enumeration-actor@gmail.com', password: await bcrypt.hash(password, 4) });
    await User.create({ email: 'occupied@gmail.com' });
    const occupied = await invoke(requestEmailChange, { email: 'occupied@gmail.com', currentPassword: password }, actor);
    await User.updateOne({ _id: actor._id }, { $unset: { pendingEmailChange: 1 } });
    const free = await invoke(requestEmailChange, { email: 'unoccupied@gmail.com', currentPassword: password }, actor);
    assert.equal(occupied.statusCode, free.statusCode);
    assert.deepEqual(occupied.body, free.body);
  });

  await t.test('an address claimed before verification has the generic invalid-link response', async () => {
    const token = 'occupied-change-token';
    await User.updateOne({ _id: user._id }, { $set: { pendingEmailChange: { email: 'occupied@gmail.com', tokenHash: hashVerificationToken(token),
      requestedAt: new Date(), expiresAt: new Date(Date.now() + 60000), sessionVersion: 3 } } });
    const taken = await invoke(verifyEmailChange, { token });
    const invalid = await invoke(verifyEmailChange, { token: 'unknown-token' });
    assert.equal(taken.statusCode, invalid.statusCode);
    assert.deepEqual(taken.body, invalid.body);
  });

  await t.test('resend exhaustion does not reveal pending registrations', async () => {
    const email = 'resend-exhausted@gmail.com';
    await PendingUser.create({ email, profile: { name: 'Candidate' }, verificationTokenHash: hashVerificationToken('resend-token'),
      verificationTokenExpiresAt: new Date(Date.now() + 60000), resendCount: 2, resendWindowStartedAt: new Date(), lastResentAt: new Date(0) });
    const exhausted = await invoke(resendVerification, { email });
    const missing = await invoke(resendVerification, { email: 'missing-registration@gmail.com' });
    assert.equal(exhausted.statusCode, missing.statusCode);
    assert.deepEqual(exhausted.body, missing.body);
    assert.equal((await PendingUser.findOne({ email })).resendCount, 2);
  });
});
