import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import { resetPassword, logout, login, authenticateWithGoogle } from '../src/controllers/authController.js';
import PendingUser from '../src/models/PendingUser.js';
import { googleIdentity } from '../src/utils/googleAuth.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';
import { resetPasswordValidation } from '../src/validation/requestValidators.js';

const hashPassword = bcrypt.hash.bind(bcrypt);
const comparePassword = bcrypt.compare.bind(bcrypt);
const replacement = 'ReplacementPassword123';
const response = () => ({
  statusCode: 200, body: null, cookies: [], cleared: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie(...args) { this.cookies.push(args); return this; },
  clearCookie(...args) { this.cleared.push(args); return this; },
});

async function reset(token, password = replacement) {
  const req = { body: { token, password } }; const res = response();
  for (const validator of resetPasswordValidation) await validator.run(req);
  await resetPassword(req, res);
  return res;
}

test('reset tokens and logout enforce durable revocation under concurrent requests', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.JWT_SECRET = 'revocation-tests-isolated-secret-at-least-32-characters';
  const { protect } = await import('../src/middleware/authMiddleware.js');
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), BlacklistedToken.init()]);
  async function fixture(version = 2, password = null) {
    const _id = new mongoose.Types.ObjectId(); const token = `reset-${_id}`;
    await User.collection.insertOne({ _id, email: `${_id}@gmail.com`, password, isVerified: true,
      ...(version === undefined ? {} : { sessionVersion: version }),
      name: 'Existing Candidate', google: { sub: `google-${_id}` },
      resetPasswordTokenHash: hashVerificationToken(token), resetPasswordExpiresAt: new Date(Date.now() + 60000),
    });
    return { _id, token };
  }

  await t.test('two simultaneous uses consume one token once and revoke old sessions', async t => {
    const { _id, token } = await fixture();
    let count = 0; let ready; let release;
    const bothHashing = new Promise(resolve => { ready = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    t.mock.method(bcrypt, 'hash', async (...args) => {
      if (++count === 2) ready();
      await gate; return hashPassword(...args);
    });
    const requests = [reset(token, 'FirstReplacement123'), reset(token, 'SecondReplacement456')];
    await bothHashing; release();
    const results = await Promise.all(requests);
    assert.deepEqual(results.map(res => res.statusCode).sort(), [200, 400]);
    const user = await User.findById(_id).lean();
    assert.equal(user.sessionVersion, 3);
    assert.equal(user.resetPasswordTokenHash, null);
    assert.equal(user.resetPasswordExpiresAt, null);
    const winner = results[0].statusCode === 200 ? 'FirstReplacement123' : 'SecondReplacement456';
    assert.equal(await bcrypt.compare(winner, user.password), true);
    assert.ok(results.every(res => res.cookies.length === 0), 'Reset still requires a fresh sign-in');
    assert.equal((await reset(token)).statusCode, 400);
    let allowed = false;
    const res = response();
    await protect({ headers: { authorization: `Bearer ${jwt.sign({ id: _id.toString(), sessionVersion: 2 }, process.env.JWT_SECRET)}` } }, res, () => { allowed = true; });
    assert.equal(allowed, false); assert.equal(res.statusCode, 401);
  });

  for (const action of ['credential-change', 'token-rotation', 'expiry']) await t.test(`a reset cannot overwrite ${action} committed while hashing`, async t => {
    const { _id, token } = await fixture();
    let started; let release;
    const hashing = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    t.mock.method(bcrypt, 'hash', async (...args) => { started(); await gate; return hashPassword(...args); });
    const request = reset(token);
    await hashing;
    const patch = action === 'credential-change'
      ? { password: await hashPassword('ConcurrentPassword789', 4), sessionVersion: 3, resetPasswordTokenHash: null, resetPasswordExpiresAt: null }
      : action === 'token-rotation' ? { resetPasswordTokenHash: hashVerificationToken('new-private-reset-token') }
        : { resetPasswordExpiresAt: new Date(0) };
    await User.updateOne({ _id }, { $set: patch });
    release();
    assert.equal((await request).statusCode, 400);
    const user = await User.findById(_id).lean();
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(user[key], value);
    assert.equal(user.sessionVersion, action === 'credential-change' ? 3 : 2);
  });

  await t.test('a token that expires naturally during hashing cannot be consumed', async t => {
    const { _id, token } = await fixture();
    t.mock.method(bcrypt, 'hash', async (...args) => {
      t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 120000 });
      return hashPassword(...args);
    });
    assert.equal((await reset(token)).statusCode, 400);
    assert.equal((await User.findById(_id)).sessionVersion, 2);
  });

  for (const version of [undefined, null, 0]) await t.test(`passwordless reset preserves OAuth/profile with legacy version ${String(version)}`, async () => {
    // Explicitly pass undefined through insertion so the field is really absent.
    const { _id, token } = await fixture(version, null);
    if (version === undefined) await User.collection.updateOne({ _id }, { $unset: { sessionVersion: '' } });
    const before = await User.findById(_id).lean();
    const res = await reset(token);
    assert.equal(res.statusCode, 200);
    const user = await User.findById(_id).lean();
    assert.equal(user.sessionVersion, 1);
    assert.equal(await bcrypt.compare(replacement, user.password), true);
    assert.deepEqual(user.google, before.google); assert.equal(user.name, before.name);
    assert.equal(res.cookies.length, 0);
  });

  await t.test('an unrelated stale legacy document save cannot restore revoked sessions', async () => {
    const { _id } = await fixture();
    await User.collection.updateOne({ _id }, { $unset: { sessionVersion: '' } });
    const stale = await User.findById(_id);
    assert.equal(stale.sessionVersion, 0);
    await User.updateOne({ _id }, { $set: { sessionVersion: 1 } });
    stale.lastLoginAt = new Date();
    await stale.save();
    assert.equal((await User.findById(_id)).sessionVersion, 1);
  });

  await t.test('new accounts and explicit legacy document version changes remain persistent', async () => {
    const created = await User.create({ email: `${new mongoose.Types.ObjectId()}@gmail.com`, password: null });
    assert.equal((await User.findById(created._id).lean()).sessionVersion, 0);
    await User.collection.updateOne({ _id: created._id }, { $unset: { sessionVersion: '' } });
    const legacy = await User.findById(created._id);
    legacy.sessionVersion = 1;
    await legacy.save();
    assert.equal((await User.findById(created._id).lean()).sessionVersion, 1);
  });

  await t.test('old-password login cannot undo a reset or issue a session after its credential check becomes stale', async t => {
    const oldPassword = 'FormerPassword123';
    const { _id, token } = await fixture(0, await hashPassword(oldPassword, 4));
    await User.collection.updateOne({ _id }, { $unset: { sessionVersion: '' } });
    let started; let release;
    const comparing = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    t.mock.method(bcrypt, 'compare', async (...args) => { started(); await gate; return comparePassword(...args); });
    const res = response();
    const signingIn = login({ body: { email: `${_id}@gmail.com`, password: oldPassword } }, res);
    await comparing;
    assert.equal((await reset(token)).statusCode, 200);
    release(); await signingIn;
    assert.equal((await User.findById(_id)).sessionVersion, 1);
    assert.equal(res.statusCode, 401);
    assert.equal(res.cookies.length, 0);
    let allowed = false;
    const oldSession = jwt.sign({ id: _id.toString(), sessionVersion: 0 }, process.env.JWT_SECRET);
    await protect({ headers: { authorization: `Bearer ${oldSession}` } }, response(), () => { allowed = true; });
    assert.equal(allowed, false);
  });

  for (const version of [2, undefined, null]) await t.test(`ordinary password login remains usable with stored version ${String(version)}`, async () => {
    const password = 'ExistingPassword123';
    const email = `${new mongoose.Types.ObjectId()}@gmail.com`;
    const user = await User.create({ email, password: await hashPassword(password, 4), isVerified: true });
    if (version === undefined) await User.collection.updateOne({ _id: user._id }, { $unset: { sessionVersion: '' } });
    else await User.collection.updateOne({ _id: user._id }, { $set: { sessionVersion: version } });
    const res = response();
    await login({ body: { email, password } }, res);
    assert.equal(res.statusCode, 200);
    const token = res.cookies[0][1];
    assert.equal(jwt.verify(token, process.env.JWT_SECRET).sessionVersion, version ?? 0);
    let allowed = false;
    await protect({ headers: { authorization: `Bearer ${token}` } }, response(), () => { allowed = true; });
    assert.equal(allowed, true);
  });

  for (const state of ['existing-passwordless', 'new', 'pending']) await t.test(`Google sign-in preserves the ${state} account flow (mocked identity provider)`, async t => {
    const email = `${new mongoose.Types.ObjectId()}@gmail.com`;
    if (state === 'existing-passwordless') {
      const user = await User.create({ email, password: null });
      await User.collection.updateOne({ _id: user._id }, { $unset: { sessionVersion: '' } });
    }
    if (state === 'pending') await PendingUser.collection.insertOne({ email, password: await hashPassword('UntrustedPendingPassword123', 4) });
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email, emailVerified: true, sub: `subject-${email}`, name: 'Google Candidate', picture: null }));
    const res = response();
    await authenticateWithGoogle({ body: { credential: 'mocked-provider-credential' } }, res);
    assert.equal(res.statusCode, 200);
    const user = await User.findOne({ email }).lean();
    assert.equal(user.password, null);
    assert.equal(user.google.sub, `subject-${email}`);
    assert.equal(user.profile.name, 'Google Candidate');
    assert.equal(user.isVerified, true);
    assert.equal(await PendingUser.countDocuments({ email }), 0);
    const token = res.cookies[0][1];
    let allowed = false;
    await protect({ headers: { authorization: `Bearer ${token}` } }, response(), () => { allowed = true; });
    assert.equal(allowed, true);
  });

  await t.test('successful and repeated logout revoke only the supplied token', async () => {
    const { _id } = await fixture();
    const token = jwt.sign({ id: _id.toString(), sessionVersion: 2 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const otherToken = jwt.sign({ id: _id.toString(), sessionVersion: 2, browser: 'other' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    for (let i = 0; i < 2; i++) {
      const res = response();
      await logout({ headers: { authorization: `Bearer ${token}` } }, res);
      assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
    }
    assert.equal(await BlacklistedToken.countDocuments({ token }), 1);
    assert.equal(await BlacklistedToken.countDocuments({ token: otherToken }), 0);
    assert.equal((await User.findById(_id)).sessionVersion, 2);
  });

  await t.test('revocation storage failure reports failure without exposing the token', async t => {
    t.mock.method(BlacklistedToken, 'create', async () => { throw new Error('isolated persistence failure'); });
    const token = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
    const res = response();
    await logout({ headers: { authorization: `Bearer ${token}` } }, res);
    assert.equal(res.statusCode, 500); assert.equal(res.body.success, false);
    assert.equal(JSON.stringify(res.body).includes(token), false);
    assert.equal(res.cleared.length, 1, 'Browser credentials clear even when durable revocation fails');
  });

  const { default: authRouter } = await import('../src/routes/authRoutes.js');
  const logoutHandlers = authRouter.stack.find(layer => layer.route?.path === '/logout').route.stack.map(layer => layer.handle);
  async function routeLogout(token) {
    const req = { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = response();
    for (const handler of logoutHandlers) {
      let continued = false;
      await handler(req, res, () => { continued = true; });
      if (!continued) break;
    }
    return res;
  }
  for (const operation of ['blacklist-read', 'user-read']) await t.test(`the declared logout route reports ${operation} failure and clears cookies without private logging`, async t => {
    const { _id } = await fixture();
    const token = jwt.sign({ id: _id.toString(), sessionVersion: 2 }, process.env.JWT_SECRET);
    const error = new Error(`private database query contains ${token}`);
    if (operation === 'blacklist-read') t.mock.method(BlacklistedToken, 'findOne', async () => { throw error; });
    else t.mock.method(User, 'findById', () => ({ select: async () => { throw error; } }));
    const logged = [];
    t.mock.method(console, 'log', (...args) => logged.push(args));
    t.mock.method(console, 'error', (...args) => logged.push(args));
    const res = await routeLogout(token);
    assert.equal(res.statusCode, 500);
    assert.ok(res.cleared.length >= 1);
    assert.equal(JSON.stringify(logged).includes(token), false);
    assert.equal(JSON.stringify(res.body).includes(token), false);
  });
  await t.test('the declared logout route preserves expired-token401 and requires authentication while clearing browser cookies', async () => {
    const { _id } = await fixture();
    const token = jwt.sign({ id: _id.toString(), sessionVersion: 2 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await routeLogout(token)).statusCode, 200);
    for (const credential of [token, 'malformed-token', undefined]) {
      const res = await routeLogout(credential);
      assert.equal(res.statusCode, 401);
      assert.ok(res.cleared.length >= 1);
    }
    assert.equal((await User.findById(_id)).sessionVersion, 2);
  });
});
