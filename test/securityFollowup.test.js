import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import PlanPurchase from '../src/models/PlanPurchase.js';
import { authenticateWithGoogle, requestPasswordReset, resetPassword, verifyEmail } from '../src/controllers/authController.js';
import { googleIdentity } from '../src/utils/googleAuth.js';
import { hashVerificationToken } from '../src/utils/authSecurity.js';
import { verifyEmailValidation, resetPasswordValidation } from '../src/validation/requestValidators.js';
import { verifyAndActivatePurchase } from '../src/services/planService.js';
import { createRazorpayProvider } from '../src/services/paymentProvider.js';

const response = () => ({ statusCode: 200, body: null, cookies: [],
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  cookie(...args) { this.cookies.push(args); }, clearCookie() {},
});
async function call(handler, body, user, rules = []) {
  const req = { body, user }; const res = response();
  for (const rule of rules) await rule.run(req);
  await handler(req, res); return res;
}
const tokenFromMail = mail => new URLSearchParams(new URL(mail.html.match(/href="([^"]+)"/)[1]).hash.slice(1)).get('token');

test('follow-up account and payment boundaries', { timeout: 120000 }, async t => {
  Object.assign(process.env, { MONGOMS_RUNTIME_DOWNLOAD: 'false', JWT_SECRET: 'followup-isolated-test-secret-at-least-32-characters',
    FRONTEND_ORIGIN: 'http://localhost:5173', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_USER: 'test', SMTP_PASS: 'test', SMTP_FROM: 'test@gmail.com',
    RAZORPAY_KEY_ID: 'local-fixture-id', RAZORPAY_KEY_SECRET: 'local-fixture-key' });
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }], binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), PendingUser.init(), PlanPurchase.init()]);
  const mails = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { mails.push(mail); return { messageId: 'fixture' }; } }));
  const password = 'MailboxOwnerPassword123!';

  await t.test('non-Workspace education identity cannot bind to an existing email account', async t => {
    const user = await User.create({ email: 'recycled@college.edu', password: await bcrypt.hash(password, 4) });
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email: user.email, emailVerified: true, sub: 'former-owner', hostedDomain: '' }));
    const res = await call(authenticateWithGoogle, { credential: 'fixture' });
    assert.equal(res.statusCode, 409);
    assert.equal(res.cookies.length, 0);
    assert.equal((await User.findById(user._id)).google?.sub ?? null, null);
  });

  await t.test('unbound external identities cannot promote pending registrations or create verified accounts', async t => {
    for (const pending of [false, true]) {
      const email = `external-${pending}@college.edu`;
      if (pending) await PendingUser.create({ email, profile: { name: 'Candidate' }, verificationTokenHash: hashVerificationToken('pending'), verificationTokenExpiresAt: new Date(Date.now() + 60000) });
      const identity = t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email, emailVerified: true, sub: `external-${pending}`, hostedDomain: '' }));
      assert.equal((await call(authenticateWithGoogle, { credential: 'fixture' })).statusCode, 409);
      assert.equal(await User.exists({ email }), null);
      if (pending) assert.ok(await PendingUser.exists({ email }));
      identity.mock.restore();
    }
  });

  await t.test('authoritative Workspace identities and already-linked external identities retain access', async t => {
    for (const linked of [false, true]) {
      const email = `trusted-${linked}@college.edu`; const sub = `trusted-sub-${linked}`;
      const user = await User.create({ email, ...(linked ? { google: { sub } } : {}) });
      const identity = t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email, emailVerified: true, sub, hostedDomain: linked ? '' : 'college.edu' }));
      const res = await call(authenticateWithGoogle, { credential: 'fixture' });
      assert.equal(res.statusCode, 200);
      assert.equal((await User.findById(user._id)).google.sub, sub);
      assert.equal(res.cookies.length, 1);
      identity.mock.restore();
    }
  });

  await t.test('unsolicited reset requests preserve an already-delivered link', async () => {
    const user = await User.create({ email: 'reset-owner@gmail.com', password: await bcrypt.hash(password, 4) });
    await call(requestPasswordReset, { email: user.email });
    const first = tokenFromMail(mails.at(-1)); const mailCount = mails.length;
    await Promise.all(Array.from({ length: 4 }, () => call(requestPasswordReset, { email: user.email })));
    assert.equal((await User.findById(user._id)).resetPasswordTokenHash, hashVerificationToken(first));
    assert.equal(mails.length, mailCount);
    assert.equal((await call(resetPassword, { token: first, password: 'ReplacementPassword123!' }, undefined, resetPasswordValidation)).statusCode, 200);
  });

  await t.test('simultaneous first reset requests reserve only one usable link', async () => {
    const user = await User.create({ email: 'concurrent-reset@gmail.com' }); const before = mails.length;
    await Promise.all([call(requestPasswordReset, { email: user.email }), call(requestPasswordReset, { email: user.email })]);
    assert.equal(mails.length - before, 1);
    assert.equal((await User.findById(user._id)).resetPasswordTokenHash, hashVerificationToken(tokenFromMail(mails.at(-1))));
  });

  await t.test('expired reset links can be replaced and stale sessions cannot reserve links', async () => {
    const oldHash = hashVerificationToken('expired-reset-token');
    const user = await User.create({ email: 'expired-reset@gmail.com', resetPasswordTokenHash: oldHash,
      resetPasswordExpiresAt: new Date(Date.now() - 60000) });
    const before = mails.length;
    await call(requestPasswordReset, { email: user.email });
    assert.equal(mails.length, before + 1);
    assert.notEqual((await User.findById(user._id)).resetPasswordTokenHash, oldHash);
    const stale = await User.create({ email: 'stale-reset@gmail.com', sessionVersion: 1 });
    await User.updateOne({ _id: stale._id }, { $set: { sessionVersion: 2 } });
    await call(requestPasswordReset, {}, stale);
    assert.equal(mails.length, before + 1);
    assert.equal((await User.findById(stale._id)).resetPasswordTokenHash, null);
  });

  await t.test('failed reset delivery releases its reservation so the same owner can retry', async t => {
    const user = await User.create({ email: 'retry-reset@gmail.com' });
    const transport = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw new Error('isolated SMTP failure'); } }));
    assert.equal((await call(requestPasswordReset, {}, user)).statusCode, 503);
    assert.equal((await User.findById(user._id)).resetPasswordTokenHash, null);
    transport.mock.restore();
    assert.equal((await call(requestPasswordReset, {}, user)).statusCode, 200);
    assert.equal(mails.at(-1).to, user.email);
  });

  async function pendingFixture(email, token) {
    return PendingUser.create({ email, profile: { name: 'Candidate' }, verificationTokenHash: hashVerificationToken(token), verificationTokenExpiresAt: new Date(Date.now() + 60000) });
  }
  await t.test('account save failure rolls back token consumption and the same link can be retried', async t => {
    const email = 'retry-registration@gmail.com'; const token = 'retry-verification';
    await pendingFixture(email, token);
    const save = t.mock.method(User.prototype, 'save', async () => { throw new Error('isolated write failure'); });
    const failed = await call(verifyEmail, { token, password }, undefined, verifyEmailValidation);
    assert.equal(failed.statusCode, 503);
    assert.ok(await PendingUser.exists({ email }));
    assert.equal(await User.exists({ email }), null);
    save.mock.restore();
    assert.equal((await call(verifyEmail, { token, password }, undefined, verifyEmailValidation)).statusCode, 200);
    assert.equal(await PendingUser.exists({ email }), null);
  });

  await t.test('simultaneous verification commits exactly one chosen password', async () => {
    const email = 'concurrent-verification@gmail.com'; const token = 'concurrent-verification-token';
    await pendingFixture(email, token);
    const passwords = [password, 'OtherMailboxPassword123!'];
    const results = await Promise.all(passwords.map(password => call(verifyEmail, { token, password }, undefined, verifyEmailValidation)));
    assert.equal(results.filter(res => res.statusCode === 200).length, 1);
    const user = await User.findOne({ email });
    assert.equal(await bcrypt.compare(passwords[results.findIndex(res => res.statusCode === 200)], user.password), true);
    assert.equal(await PendingUser.exists({ email }), null);
  });

  async function purchaseFixture() {
    const user = await User.create({ email: `${new mongoose.Types.ObjectId()}@gmail.com` });
    const purchase = await PlanPurchase.create({ user: user._id, planId: 'monthly', accessRole: 'monthly_premium_user', amount: 99, currency: 'INR',
      provider: 'razorpay', status: 'pending', providerOrderId: `order_${user._id}` });
    const providerPaymentId = `pay_${user._id}`;
    return { user, purchase, input: { purchaseId: purchase._id, userId: user._id, providerOrderId: purchase.providerOrderId,
      providerPaymentId, providerSignature: createHmac('sha256', 'local-fixture-key').update(`${purchase.providerOrderId}|${providerPaymentId}`).digest('hex') },
      payment: { id: providerPaymentId, order_id: purchase.providerOrderId, amount: 9900, currency: 'INR', status: 'captured' } };
  }
  const providerFor = payment => ({ getProvider: () => createRazorpayProvider({
    fetchImpl: async () => ({ ok: true, json: async () => payment }),
  }) });
  await t.test('an invalid signature cannot reach the provider lookup or activate access', async () => {
    const { user, input } = await purchaseFixture();
    await assert.rejects(verifyAndActivatePurchase({ ...input, providerSignature: '0'.repeat(64) }, {
      getProvider: () => createRazorpayProvider({ fetchImpl: async () => assert.fail('invalid signature must not fetch payment') }),
    }), /verification failed/i);
    assert.equal((await User.findById(user._id)).accessRole, 'free_user');
  });
  await t.test('a signed callback with an authorized but uncaptured payment cannot activate premium', async () => {
    const { user, purchase, input, payment } = await purchaseFixture();
    await assert.rejects(verifyAndActivatePurchase(input, providerFor({ ...payment, status: 'authorized' })), /captured/i);
    assert.equal((await PlanPurchase.findById(purchase._id)).status, 'pending');
    assert.equal((await User.findById(user._id)).accessRole, 'free_user');
  });

  await t.test('capture evidence must match payment ID, order, amount and currency', async () => {
    for (const patch of [{ id: 'pay_other' }, { order_id: 'order_other' }, { amount: 1 }, { currency: 'USD' }, { status: 'refunded' }]) {
      const { user, input, payment } = await purchaseFixture();
      await assert.rejects(verifyAndActivatePurchase(input, providerFor({ ...payment, ...patch })));
      assert.equal((await User.findById(user._id)).accessRole, 'free_user');
    }
  });

  await t.test('a matching captured payment activates once; provider failure grants nothing', async () => {
    const { user, purchase, input, payment } = await purchaseFixture();
    let fetched = 0;
    const options = { getProvider: () => createRazorpayProvider({ fetchImpl: async () => {
      fetched++; return { ok: true, json: async () => payment };
    } }) };
    await verifyAndActivatePurchase(input, options);
    assert.equal(fetched, 1);
    const expiresAt = (await User.findById(user._id)).premium.expiresAt;
    await verifyAndActivatePurchase(input, options);
    assert.equal(fetched, 1);
    assert.equal((await PlanPurchase.findById(purchase._id)).status, 'paid');
    assert.deepEqual((await User.findById(user._id)).premium.expiresAt, expiresAt);
    const failed = await purchaseFixture();
    await assert.rejects(verifyAndActivatePurchase(failed.input, { getProvider: () => createRazorpayProvider({
      fetchImpl: async () => { throw new Error('fixture outage'); },
    }) }));
    assert.equal((await User.findById(failed.user._id)).accessRole, 'free_user');
  });
});
