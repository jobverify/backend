import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../../src/models/User.js';
import PlanPurchase from '../../src/models/PlanPurchase.js';
import { activateWebhookPurchase, verifyAndActivatePurchase, reconcileWebhookRefund } from '../../src/services/planService.js';

test('payment ownership, validation, idempotency, refunds and rollback use real transactions', { timeout: 120_000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: {
    version: '8.2.6', downloadDir: path.resolve(import.meta.dirname, '../../.cache/mongodb-binaries'),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const uri = mongo.getUri();
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri);
  await Promise.all([User.init(), PlanPurchase.init()]);
  const now = new Date('2026-11-07T08:00:00Z');
  async function fixture() {
    const id = new mongoose.Types.ObjectId();
    const user = await User.create({ email: `${id}@gmail.com` });
    const purchase = await PlanPurchase.create({ user: user._id, planId: 'monthly',
      accessRole: 'monthly_premium_user', amount: 99, currency: 'INR', provider: 'razorpay',
      providerOrderId: `order_${id}`, status: 'pending' });
    const payment = { id: `pay_${id}`, order_id: purchase.providerOrderId, amount: 9900, currency: 'INR', status: 'captured' };
    const capture = overrides => activateWebhookPurchase({ provider: 'razorpay',
      providerOrderId: purchase.providerOrderId, providerPaymentId: payment.id, payment: { ...payment, ...overrides }, now });
    return { user, purchase, payment, capture };
  }
  await t.test('a different account cannot verify the purchase', async () => {
    const { purchase } = await fixture();
    await assert.rejects(verifyAndActivatePurchase({ purchaseId: purchase._id,
      userId: new mongoose.Types.ObjectId(), now }, { getProvider: () => assert.fail('owner check must precede provider access') }), /Purchase not found/);
    assert.equal((await PlanPurchase.findById(purchase._id)).status, 'pending');
  });
  await t.test('wrong amount and currency do not grant access', async () => {
    const { user, capture } = await fixture();
    for (const invalid of [{ amount: 1 }, { currency: 'USD' }]) await assert.rejects(capture(invalid), /does not match/);
    assert.equal((await User.findById(user._id)).accessRole, 'free_user');
  });
  await t.test('duplicate capture does not extend access twice', async () => {
    const { user, capture } = await fixture();
    const first = await capture();
    const second = await capture();
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.equal((await User.findById(user._id)).premium.expiresAt.toISOString(), '2026-12-07T08:00:00.000Z');
  });
  await t.test('partial refunds retain access and full refunds revoke it exactly once', async () => {
    const { user, purchase, payment, capture } = await fixture();
    await capture();
    const refund = (id, amount) => reconcileWebhookRefund({ provider: 'razorpay', event: 'refund.processed',
      payment, refund: { id, payment_id: payment.id, amount, currency: 'INR', status: 'processed' },
      now: new Date('2026-11-08T08:00:00Z') });
    await refund(`rfnd_partial_${purchase._id}`, 1000);
    assert.equal((await User.findById(user._id)).accessRole, 'monthly_premium_user');
    await refund(`rfnd_remaining_${purchase._id}`, 8900);
    const duplicate = await refund(`rfnd_remaining_${purchase._id}`, 8900);
    assert.equal(duplicate.idempotent, true);
    assert.equal((await User.findById(user._id)).accessRole, 'free_user');
    const recorded = await PlanPurchase.findById(purchase._id);
    assert.equal(recorded.status, 'refunded');
    assert.equal(recorded.refundedAmount, 99);
    assert.equal(recorded.refunds.length, 2);
  });
  await t.test('a purchase write failure rolls back the preceding user entitlement write', async t => {
    const { user, purchase, capture } = await fixture();
    const save = PlanPurchase.prototype.save;
    t.mock.method(PlanPurchase.prototype, 'save', function (...args) {
      if (String(this._id) === String(purchase._id) && this.status === 'paid') throw new Error('synthetic purchase write failure');
      return save.apply(this, args);
    });
    await assert.rejects(capture(), /synthetic purchase write failure/);
    assert.equal((await User.findById(user._id)).accessRole, 'free_user');
    assert.equal((await PlanPurchase.findById(purchase._id)).status, 'pending');
  });
});
