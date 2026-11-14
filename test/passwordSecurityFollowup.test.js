import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import { login, logout, verifyEmail, resetPassword, changePassword, authenticateWithGoogle } from '../src/controllers/authController.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';
import { googleIdentity } from '../src/utils/googleAuth.js';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { protect, protectLogout, optionalProtect } = await import('../src/middleware/authMiddleware.js');
const oldPassword = 'Canary-Violet9!River', newPassword = 'Harbor-Cobalt7!Meadow';
const response = () => ({ statusCode: 200, body: null, cookies: [], cleared: [],
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  cookie(...args) { this.cookies.push(args); return this; }, clearCookie(...args) { this.cleared.push(args); return this; },
});
const request = user => ({ headers: { authorization: 'Bearer ' + jwt.sign(
  { id: String(user._id), sessionVersion: user.sessionVersion ?? 0 }, process.env.JWT_SECRET,
) } });

test('password screening and verified-account authority', { timeout: 180000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }], binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), PendingUser.init(), BlacklistedToken.init()]);
  let range = 'clean', lookups = 0, sequence = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(String(url), /^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/);
    lookups++;
    if (range === 'unavailable') throw new Error('fixture unavailable');
    return new Response(range === 'compromised'
      ? 'F5F70D47ADC2DB2EB397FBEF5F7BC560E29:42\r\n' : '0'.repeat(35) + ':0\r\n');
  });
  const account = async (isVerified = true) => User.create({
    email: 'security-followup-' + (++sequence) + '@gmail.com', isVerified,
    password: await bcrypt.hash(oldPassword, 4), sessionVersion: 2,
  });
  const resetToken = async user => {
    const token = 'fixture-reset-' + user._id;
    await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: hashVerificationToken(token),
      resetPasswordExpiresAt: new Date(Date.now() + 60000) } });
    return token;
  };

  await t.test('compromised verification passwords leave the pending account and link intact', async () => {
    range = 'compromised';
    const email = 'breached-verification@gmail.com', token = 'fixture-verification-token';
    await PendingUser.create({ email, profile: { name: 'Candidate' }, verificationTokenHash: hashVerificationToken(token),
      verificationTokenExpiresAt: new Date(Date.now() + 60000) });
    const res = response();
    await verifyEmail({ body: { token, password: 'Password123!', dateOfBirth: '1990-01-01' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'password_compromised');
    assert.equal(await User.exists({ email }), null);
    assert.ok(await PendingUser.exists({ email, verificationTokenHash: hashVerificationToken(token) }));
  });
  for (const action of ['reset', 'change']) await t.test('compromised ' + action + ' preserves credentials and tokens', async () => {
    range = 'compromised';
    const user = await account(), token = await resetToken(user), res = response();
    if (action === 'reset') await resetPassword({ body: { token, password: 'Password123!' } }, res);
    else await changePassword({ user, body: { oldPassword, newPassword: 'Password123!' } }, res);
    assert.equal(res.statusCode, 400);
    const stored = await User.findById(user._id);
    assert.equal(stored.password, user.password);
    assert.equal(stored.sessionVersion, 2);
    assert.equal(stored.resetPasswordTokenHash, hashVerificationToken(token));
    assert.equal(res.cookies.length, 0);
  });
  await t.test('screening failure permits retrying the same reset link', async () => {
    range = 'unavailable';
    const user = await account(false), token = await resetToken(user), res = response();
    await resetPassword({ body: { token, password: newPassword } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'password_check_unavailable');
    assert.equal((await User.findById(user._id)).resetPasswordTokenHash, hashVerificationToken(token));
    range = 'clean';
    const retry = response();
    await resetPassword({ body: { token, password: newPassword } }, retry);
    assert.equal(retry.statusCode, 200);
  });
  await t.test('invalid tokens never trigger external password lookups', async () => {
    const before = lookups, res = response();
    await resetPassword({ body: { token: 'missing-token', password: newPassword } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(lookups, before);
  });
  await t.test('unverified password login cannot save login state or issue a cookie', async () => {
    const user = await account(false), res = response();
    await login({ body: { email: user.email, password: oldPassword } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'email_verification_required');
    assert.equal(res.cookies.length, 0);
    assert.equal((await User.findById(user._id)).lastLoginAt, undefined);
  });
  for (const state of ['false', 'missing', 'null']) await t.test(state + ' verification cannot authorize bearer or cookie requests', async () => {
    const user = await account(false);
    if (state === 'missing') await User.collection.updateOne({ _id: user._id }, { $unset: { isVerified: 1 } });
    if (state === 'null') await User.collection.updateOne({ _id: user._id }, { $set: { isVerified: null } });
    const bearer = request(user);
    for (const headers of [bearer.headers, { cookie: 'jobverify_token=' + bearer.headers.authorization.slice(7) }]) {
      const res = response(); let authorized = false;
      await protect({ headers }, res, () => { authorized = true; });
      assert.equal(authorized, false);
      assert.equal(res.statusCode, 401);
      const optional = { headers }; let continued = false;
      await optionalProtect(optional, response(), () => { continued = true; });
      assert.equal(continued, true);
      assert.equal(optional.user, undefined);
    }
  });
  await t.test('unverified sessions can still be logged out and durably revoked', async () => {
    const user = await account(false), req = request(user), res = response(); let accepted = false;
    await protectLogout(req, res, () => { accepted = true; });
    assert.equal(accepted, true);
    await logout(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.cleared.some(([name]) => name === 'jobverify_token'));
    assert.ok(await BlacklistedToken.exists({ token: req.headers.authorization.slice(7) }));
  });
  await t.test('mailbox reset verifies legacy ownership, revokes old sessions and restores login', async () => {
    range = 'clean';
    const user = await account(false), oldRequest = request(user), token = await resetToken(user), res = response();
    await resetPassword({ body: { token, password: newPassword } }, res);
    assert.equal(res.statusCode, 200);
    const stored = await User.findById(user._id);
    assert.equal(stored.isVerified, true);
    assert.equal(stored.sessionVersion, 3);
    assert.equal(await bcrypt.compare(newPassword, stored.password), true);
    let allowed = false;
    await protect(oldRequest, response(), () => { allowed = true; });
    assert.equal(allowed, false);
    const signedIn = response();
    await login({ body: { email: user.email, password: newPassword } }, signedIn);
    assert.equal(signedIn.statusCode, 200);
    assert.equal(signedIn.cookies.length, 1);
  });
  await t.test('reset proof cannot verify an address changed during hashing', async t => {
    range = 'clean';
    const user = await account(false), token = await resetToken(user), hash = bcrypt.hash.bind(bcrypt);
    t.mock.method(bcrypt, 'hash', async (...args) => {
      await User.collection.updateOne({ _id: user._id }, { $set: { email: 'different-mailbox@gmail.com' } });
      return hash(...args);
    });
    const res = response();
    await resetPassword({ body: { token, password: newPassword } }, res);
    assert.equal(res.statusCode, 400);
    const stored = await User.findById(user._id);
    assert.equal(stored.isVerified, false);
    assert.equal(stored.password, user.password);
  });
  await t.test('verified Google identity can still promote a legacy account', async t => {
    const user = await account(false);
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({
      email: user.email, emailVerified: true, sub: 'fixture-google-' + user._id, name: 'Candidate',
    }));
    const res = response();
    await authenticateWithGoogle({ body: { credential: 'fixture', dateOfBirth: '1990-01-01' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.cookies.length, 1);
    assert.equal((await User.findById(user._id)).isVerified, true);
  });
  await t.test('verification revocation racing session save prevents cookie issuance', async t => {
    const user = await account(), save = User.prototype.save;
    t.mock.method(User.prototype, 'save', async function (...args) {
      if (!this.isNew && String(this._id) === String(user._id)) {
        await User.collection.updateOne({ _id: user._id }, { $set: { isVerified: false } });
      }
      return save.apply(this, args);
    });
    const res = response();
    await login({ body: { email: user.email, password: oldPassword } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.cookies.length, 0);
  });
  await t.test('stale authenticated requests cannot renew unverified accounts by changing passwords', async () => {
    range = 'clean';
    const user = await account(false), res = response();
    await changePassword({ user: { _id: user._id, isVerified: true, sessionVersion: 2 },
      body: { oldPassword, newPassword } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal((await User.findById(user._id)).password, user.password);
    assert.equal(res.cookies.length, 0);
  });
});
