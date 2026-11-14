import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordSafety } from '../src/services/passwordSafety.js';
// These compatibility fixtures isolate the external password provider.
test.beforeEach(t => { t.mock.method(passwordSafety, 'check', async () => {}); });
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { validationResult } from 'express-validator';

const response = () => ({ statusCode: 200, body: null, cookies: [],
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  cookie(...args) { this.cookies.push(args); return this; }, clearCookie() { return this; },
});

test('Apple sign-in requires a browser-bound one-time challenge and a verified stable subject', { timeout: 90000 }, async t => {
  const controller = await import('../src/controllers/appleAuthController.js');
  const { appleIdentity, decryptAppleRefreshToken, hashAppleChallenge } = await import('../src/utils/appleAuth.js');
  const { default: Challenge } = await import('../src/models/AppleAuthChallenge.js');
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  }, instance: { launchTimeout: 60000 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), PendingUser.init(), Challenge.init()]);
  const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'apple-session-test-secret-more-than-32-characters',
    APPLE_AUTH_ENABLED: 'true', APPLE_CLIENT_ID: 'in.jobverify.web', APPLE_TEAM_ID: 'TESTTEAM12', APPLE_KEY_ID: 'TESTKEY123',
    APPLE_PRIVATE_KEY: signing.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    APPLE_REDIRECT_URI: 'https://www.example.com/login', APPLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') });
  let identity = { sub: 'apple-subject-one', email: 'hidden@privaterelay.appleid.com', emailVerified: true,
    privateEmail: true, refreshToken: 'private-refresh-token' };
  t.mock.method(appleIdentity, 'verifyResponse', async ({ nonceHash, code, idToken }) => {
    assert.match(nonceHash, /^[a-f0-9]{64}$/); assert.equal(code, 'fresh-code'); assert.equal(idToken, 'signed-token');
    return identity;
  });
  const challenge = async () => {
    const res = response(); await controller.createAppleChallenge({ headers: {} }, res);
    assert.equal(res.statusCode, 200);
    return { ...res.body, cookie: `${res.cookies[0][0]}=${res.cookies[0][1]}` };
  };
  const signIn = async (entry, patch = {}, cookie = entry.cookie) => {
    const res = response();
    await controller.authenticateWithApple({ headers: { cookie }, body: { dateOfBirth: '2000-01-15', state: entry.state,
      idToken: 'signed-token', code: 'fresh-code', name: { firstName: 'Anu', lastName: 'Rao' }, ...patch } }, res);
    return res;
  };
  await t.test('unconfigured Apple exposes no active integration', async () => {
    process.env.APPLE_AUTH_ENABLED = 'false';
    const config = response(); controller.getAppleConfiguration({}, config);
    assert.equal(config.body.enabled, false);
    const res = response(); await controller.createAppleChallenge({ headers: {} }, res);
    assert.equal(res.statusCode, 503); assert.equal(res.cookies.length, 0);
    process.env.APPLE_AUTH_ENABLED = 'true';
  });
  await t.test('fresh challenges store hashes, expire, and require the issuing browser', async () => {
    const a = await challenge(); const b = await challenge();
    assert.notEqual(a.state, b.state); assert.notEqual(a.nonce, b.nonce);
    assert.ok(!JSON.stringify(await Challenge.findOne().lean()).includes(a.nonce));
    assert.equal((await signIn(a, {}, b.cookie)).statusCode, 401);
    assert.equal((await signIn(a, { state: 'wrong-state' })).statusCode, 401);
    await Challenge.updateOne({ stateHash: hashAppleChallenge(a.state) }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await signIn(a)).statusCode, 401);
    assert.equal(await User.countDocuments(), 0);
  });
  let userId;
  await t.test('concurrent callbacks issue one normal session and never expose encrypted tokens', async () => {
    const entry = await challenge();
    const results = await Promise.all([signIn(entry), signIn(entry)]);
    assert.deepEqual(results.map(res => res.statusCode).sort(), [200, 401]);
    const winner = results.find(res => res.statusCode === 200);
    const sessionCookie = winner.cookies.find(([name]) => name === 'jobverify_token');
    assert.equal(jwt.verify(sessionCookie[1], process.env.JWT_SECRET).sessionVersion, 0);
    assert.equal(sessionCookie[2].httpOnly, true);
    const user = await User.findOne({ 'apple.sub': identity.sub }).select('+apple.refreshToken');
    userId = user._id;
    assert.equal(user.email, 'hidden@privaterelay.appleid.com'); assert.equal(user.profile.name, 'Anu Rao');
    assert.equal(user.password, null); assert.equal(user.telegramAlertsAllowed, false);
    assert.equal(decryptAppleRefreshToken(user.apple.refreshToken, process.env.APPLE_TOKEN_ENCRYPTION_KEY), 'private-refresh-token');
    assert.ok(!JSON.stringify(user.toJSON()).includes(user.apple.refreshToken));
    assert.ok(!JSON.stringify(winner.body).includes('refreshToken'));
    assert.equal((await User.findById(userId)).apple.refreshToken, undefined);
    assert.equal((await signIn(entry)).statusCode, 401);
  });
  await t.test('returning users match by subject, keep names and can omit the one-time name/email payload', async () => {
    identity = { ...identity, email: '', emailVerified: false };
    const result = await signIn(await challenge(), { name: undefined });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.user.id.toString(), userId.toString());
    assert.equal((await User.findById(userId)).profile.name, 'Anu Rao');
  });
  await t.test('a new subject cannot link by matching the email of an existing account', async () => {
    identity = { ...identity, sub: 'different-subject', email: 'hidden@privaterelay.appleid.com', emailVerified: true };
    assert.equal((await signIn(await challenge())).statusCode, 409);
    assert.equal(await User.countDocuments(), 1);
    assert.equal((await User.findById(userId)).apple.sub, 'apple-subject-one');
  });
  await t.test('a private relay mailbox can set a password and use ordinary login without widening email signup', async t => {
    const { requestPasswordReset, resetPassword, login } = await import('../src/controllers/authController.js');
    const { loginValidation, registerValidation, resetPasswordValidation } = await import('../src/validation/requestValidators.js');
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.EMAIL_RELAY_URL = '';
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@gmail.com' });
    let mail;
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async value => { mail = value; return { messageId: 'offline-apple-recovery' }; } }));
    const requested = response();
    await requestPasswordReset({ user: await User.findById(userId), body: {} }, requested);
    assert.equal(requested.statusCode, 200);
    assert.equal(mail.to, 'hidden@privaterelay.appleid.com');
    const link = new URL(mail.html.match(/href="([^"]+)"/)[1]);
    const token = new URLSearchParams(link.hash.slice(1)).get('token');
    const password = 'RelayMailboxPassword123!';
    const resetting = { body: { token, password } };
    for (const rule of resetPasswordValidation) await rule.run(resetting);
    const reset = response(); await resetPassword(resetting, reset);
    assert.equal(reset.statusCode, 200);
    const signingIn = { body: { email: 'hidden@privaterelay.appleid.com', password } };
    for (const rule of loginValidation) await rule.run(signingIn);
    assert.equal(validationResult(signingIn).isEmpty(), true);
    const loggedIn = response(); await login(signingIn, loggedIn);
    assert.equal(loggedIn.statusCode, 200);
    const ordinarySignup = { body: { name: 'Anu Rao', email: 'new@privaterelay.appleid.com' } };
    for (const rule of registerValidation) await rule.run(ordinarySignup);
    assert.equal(validationResult(ordinarySignup).isEmpty(), false);
  });
  await t.test('deactivated and deleting accounts cannot receive a session', async () => {
    identity = { ...identity, sub: 'apple-subject-one' };
    for (const update of [{ deactivated: true }, { deactivated: false, accountDeletingAt: new Date() }]) {
      await User.updateOne({ _id: userId }, { $set: update });
      const result = await signIn(await challenge());
      assert.equal(result.statusCode, 403); assert.equal(result.cookies.length, 0);
    }
  });
  await t.test('new users require verified mail and pending registration credentials are never inherited', async () => {
    identity = { ...identity, sub: 'new-subject', email: '', emailVerified: false };
    assert.equal((await signIn(await challenge())).statusCode, 400);
    identity = { ...identity, email: 'candidate@icloud.com', emailVerified: true };
    await PendingUser.create({ email: identity.email, password: 'untrusted-password', profile: { name: 'Untrusted Name' },
      verificationTokenHash: 'pending-token-hash', verificationTokenExpiresAt: new Date(Date.now() + 60000) });
    const result = await signIn(await challenge(), { name: { firstName: '<script>bad</script>' } });
    assert.equal(result.statusCode, 200);
    const user = await User.findOne({ 'apple.sub': identity.sub });
    assert.equal(user.password, null); assert.equal(user.profile.name ?? '', '');
    assert.equal(await PendingUser.countDocuments({ email: identity.email }), 0);
  });
});
