import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordSafety } from '../src/services/passwordSafety.js';
// These compatibility fixtures isolate the external password provider.
test.beforeEach(t => { t.mock.method(passwordSafety, 'check', async () => {}); });
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import { register, verifyEmail, login, requestPasswordReset, authenticateWithGoogle } from '../src/controllers/authController.js';
import { requestEmailChange, verifyEmailChange } from '../src/controllers/emailChangeController.js';
import { googleIdentity } from '../src/utils/googleAuth.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';
import { validateRequest } from '../src/middleware/validateRequest.js';
import { registerValidation, loginValidation, forgotPasswordValidation, verifyEmailValidation } from '../src/validation/requestValidators.js';

const response = () => ({ statusCode: 200, body: null, cookies: [],
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  cookie(...args) { this.cookies.push(args); return this; }, clearCookie() {},
});
async function invoke(handler, body, user, rules = []) {
  const req = { body: { dateOfBirth: '2000-01-15', ...body }, user }; const res = response();
  for (const rule of rules) await rule.run(req);
  let valid = false;
  validateRequest(req, res, () => { valid = true; });
  if (valid) await handler(req, res);
  return res;
}

test('new email identities are ASCII while existing identity lookups remain stable', { timeout: 120_000 }, async t => {
  Object.assign(process.env, { MONGOMS_RUNTIME_DOWNLOAD: 'false', EMAIL_RELAY_URL: '',
    JWT_SECRET: 'identity-policy-fixture-secret-at-least-32-characters', FRONTEND_ORIGIN: 'http://localhost:5173',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_USER: 'fixture', SMTP_PASS: 'fixture', SMTP_FROM: 'fixture@gmail.com' });
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60_000 }], binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), PendingUser.init()]);
  const mails = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { mails.push(mail); return { messageId: 'fixture' }; } }));
  const password = 'IdentityFixturePassword123!';
  const passwordHash = await bcrypt.hash(password, 4);
  const { default: router } = await import('../src/routes/authRoutes.js');
  const changeRules = router.stack.find(layer => layer.route?.path === '/change-email').route.stack
    .map(layer => layer.handle).filter(handler => typeof handler.run === 'function');

  await t.test('registration rejects Unicode before lowercasing, including the Kelvin sign', async () => {
    for (const email of ['\u00e9.new@college.edu', 'e\u0301.new@college.edu', '\u212Aate@gmail.com', 'owner@c\u00f6llege.edu']) {
      const result = await invoke(register, { name: 'Candidate', email }, undefined, registerValidation);
      assert.equal(result.statusCode, 400, email);
    }
    assert.equal(await PendingUser.countDocuments(), 0);
  });

  await t.test('ASCII registration retains case and whitespace handling', async () => {
    const result = await invoke(register, { name: 'Candidate', email: ' Student.New@College.EDU ' }, undefined, registerValidation);
    assert.equal(result.statusCode, 201);
    assert.ok(await PendingUser.exists({ email: 'student.new@college.edu' }));
  });

  await t.test('old Unicode verification links do not create identities or consume the pending token', async () => {
    const email = '\u00e9.pending@college.edu'; const token = 'unicode-pending-fixture';
    const pending = await PendingUser.create({ email, profile: { name: 'Candidate' }, verificationTokenHash: hashVerificationToken(token),
      verificationTokenExpiresAt: new Date(Date.now() + 60_000) });
    assert.equal((await invoke(verifyEmail, { token, password }, undefined, verifyEmailValidation)).statusCode, 400);
    assert.equal(await User.exists({ email }), null);
    assert.ok(await PendingUser.exists({ _id: pending._id, verificationTokenHash: hashVerificationToken(token) }));
  });

  await t.test('verification cannot promote an email changed after its policy check', async t => {
    const token = 'pending-race-fixture'; const email = 'pending-race@college.edu';
    const pending = await PendingUser.create({ email, profile: { name: 'Candidate' }, verificationTokenHash: hashVerificationToken(token),
      verificationTokenExpiresAt: new Date(Date.now() + 60_000) });
    const hash = bcrypt.hash.bind(bcrypt);
    t.mock.method(bcrypt, 'hash', async (...args) => {
      await PendingUser.updateOne({ _id: pending._id }, { $set: { email: '\u00e9.raced@college.edu' } });
      return hash(...args);
    });
    assert.equal((await invoke(verifyEmail, { token, password }, undefined, verifyEmailValidation)).statusCode, 400);
    assert.ok(await PendingUser.exists({ _id: pending._id }));
    assert.equal(await User.exists({ email: '\u00e9.raced@college.edu' }), null);
  });

  await t.test('Google cannot create or promote new Unicode identities', async t => {
    for (const [email, pending] of [['\u00e9.google@college.edu', false], ['\u00e9.google-pending@college.edu', true], ['new-\u212Aate@gmail.com', false]]) {
      if (pending) await PendingUser.create({ email, profile: { name: 'Candidate' },
        verificationTokenHash: hashVerificationToken('google-pending-fixture'), verificationTokenExpiresAt: new Date(Date.now() + 60_000) });
      const identity = t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email, emailVerified: true, sub: `subject-${email}`, hostedDomain: 'college.edu' }));
      const result = await invoke(authenticateWithGoogle, { credential: 'fixture' });
      identity.mock.restore();
      assert.equal(result.statusCode, 400, email);
      assert.equal(await User.exists({ email: email.toLowerCase() }), null);
      if (pending) assert.ok(await PendingUser.exists({ email }));
    }
  });

  await t.test('legacy composed and decomposed identities retain distinct password access and recovery', async () => {
    const ids = [];
    for (const email of ['\u00e9.legacy@college.edu', 'e\u0301.legacy@college.edu']) {
      const user = await User.create({ email, password: passwordHash, isVerified: true });
      const result = await invoke(login, { email, password }, undefined, loginValidation);
      assert.equal(result.statusCode, 200);
      assert.equal(String(result.body.user.id), String(user._id));
      ids.push(String(result.body.user.id));
      assert.equal((await invoke(requestPasswordReset, { email }, undefined, forgotPasswordValidation)).statusCode, 200);
      const stored = await User.findById(user._id);
      assert.equal(stored.email, email);
      assert.ok(stored.resetPasswordTokenHash);
      assert.ok(mails.some(mail => mail.to === email));
    }
    assert.notEqual(ids[0], ids[1]);
  });

  await t.test('an existing Unicode Google identity retains its bound subject and account', async t => {
    const email = '\u00e9.linked@college.edu'; const sub = 'legacy-bound-subject';
    const user = await User.create({ email, google: { sub }, isVerified: true });
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email, sub, emailVerified: true, hostedDomain: '' }));
    const result = await invoke(authenticateWithGoogle, { credential: 'fixture' });
    assert.equal(result.statusCode, 200);
    assert.equal(String(result.body.user.id), String(user._id));
    assert.equal((await User.findById(user._id)).email, email);
  });

  await t.test('email-change route checks raw Unicode input before normalization', async () => {
    const user = await User.create({ email: 'change-owner@gmail.com', password: passwordHash, isVerified: true });
    for (const email of ['\u00e9.change@college.edu', '\u212Aate.change@gmail.com', 'owner@c\u00f6llege.edu']) {
      assert.equal((await invoke(requestEmailChange, { email, currentPassword: password }, user, changeRules)).statusCode, 400, email);
    }
    assert.equal((await User.findById(user._id).select('+pendingEmailChange')).pendingEmailChange, undefined);
    assert.equal((await invoke(requestEmailChange, { email: ' Changed.Owner@College.EDU ', currentPassword: password }, user, changeRules)).statusCode, 200);
    assert.equal((await User.findById(user._id).select('+pendingEmailChange')).pendingEmailChange.email, 'changed.owner@college.edu');
  });

  await t.test('email-change verification cannot use a destination changed after its policy check', async t => {
    const token = 'email-change-race-fixture';
    const user = await User.create({ email: 'race-owner@gmail.com', sessionVersion: 3,
      pendingEmailChange: { email: 'race-destination@college.edu', tokenHash: hashVerificationToken(token), requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000), sessionVersion: 3 } });
    const update = User.findOneAndUpdate.bind(User);
    t.mock.method(User, 'findOneAndUpdate', async (...args) => {
      await User.updateOne({ _id: user._id }, { $set: { 'pendingEmailChange.email': '\u00e9.race-destination@college.edu' } });
      return update(...args);
    });
    assert.equal((await invoke(verifyEmailChange, { token })).statusCode, 400);
    const stored = await User.findById(user._id).select('+pendingEmailChange');
    assert.equal(stored.email, 'race-owner@gmail.com');
    assert.equal(stored.sessionVersion, 3);
    assert.equal(stored.pendingEmailChange.tokenHash, hashVerificationToken(token));
  });

  await t.test('old Unicode email-change links preserve the current identity and session', async () => {
    const token = 'unicode-email-change-fixture';
    const user = await User.create({ email: 'unchanged-owner@gmail.com', sessionVersion: 2,
      pendingEmailChange: { email: '\u00e9.destination@college.edu', tokenHash: hashVerificationToken(token), requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000), sessionVersion: 2 } });
    assert.equal((await invoke(verifyEmailChange, { token })).statusCode, 400);
    const stored = await User.findById(user._id).select('+pendingEmailChange');
    assert.equal(stored.email, 'unchanged-owner@gmail.com');
    assert.equal(stored.sessionVersion, 2);
    assert.equal(stored.pendingEmailChange.tokenHash, hashVerificationToken(token));
  });
});
