import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import RateLimitBucket from '../src/models/RateLimitBucket.js';
import { MongoRateLimitStore } from '../src/utils/mongoRateLimitStore.js';
import User from '../src/models/User.js';
import PlanPurchase from '../src/models/PlanPurchase.js';
import { createCheckout, verifyAndActivatePurchase } from '../src/services/planService.js';

Object.assign(process.env, {
  NODE_ENV: 'test', JWT_SECRET: 'private-test-session-secret-at-least-32',
  CORS_ORIGIN: 'https://www.jobverify.test', JOBVERIFY_PUBLISHING_TOKEN: 'private-publishing-fixture-at-least-32',
  MONGOMS_RUNTIME_DOWNLOAD: 'false',
  ENABLE_RATE_LIMITING: 'true', PAYMENT_PROVIDER: 'mock',
});

test('shared production quotas and the private frontend budget boundary', { timeout: 90_000 }, async t => {
  const mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await RateLimitBucket.init();

  await t.test('server prices ignore forged fields and another user cannot activate the purchase', async () => {
    const owner = await User.create({ email: 'owner@example.test' });
    const other = await User.create({ email: 'other@example.test' });
    const { purchase, checkout } = await createCheckout({ user: owner, planId: 'monthly', amount: 1, priceInr: 1, role: 'admin', isPro: true });
    assert.equal(purchase.amount, 99);
    assert.equal(checkout.amount, 99);
    assert.equal(purchase.accessRole, 'monthly_premium_user');
    await assert.rejects(verifyAndActivatePurchase({ purchaseId: purchase._id, userId: other._id, providerPaymentId: 'forged', providerSignature: 'forged' }), /not found/i);
    assert.equal((await PlanPurchase.findById(purchase._id)).status, 'pending');
    assert.equal((await User.findById(other._id)).accessRole, 'free_user');
  });

  await t.test('replicas increment one atomic counter and reset independently of TTL deletion', async () => {
    let now = 60_001;
    const first = new MongoRateLimitStore({ prefix: 'fixture', now: () => now });
    const second = new MongoRateLimitStore({ prefix: 'fixture', now: () => now });
    const counts = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? first : second).increment('client')));
    assert.deepEqual(counts.map(result => result.totalHits).sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 1));
    assert.equal(counts[0].resetTime.getTime(), 120_000);
    const other = new MongoRateLimitStore({ prefix: 'other', now: () => now });
    assert.equal((await other.increment('client')).totalHits, 1);
    now = 120_001;
    assert.equal((await first.increment('client')).totalHits, 1);
    assert.ok(RateLimitBucket.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
  });

  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/publishing/rate-limit`;
  const send = (body, token = process.env.JOBVERIFY_PUBLISHING_TOKEN) => fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body),
  });

  await t.test('browser flags and unknown policy values cannot obtain a budget', async () => {
    const denied = await send({ policy: 'sitemap', clientKey: 'a'.repeat(64), role: 'admin' }, '');
    assert.equal(denied.status, 401);
    await denied.text();
    for (const body of [{ policy: 'unlimited', clientKey: 'a'.repeat(64) },
      { policy: 'sitemap', clientKey: { $ne: null } }, { policy: 'sitemap', clientKey: 'a'.repeat(64), limit: 999999 }]) {
      const invalid = await send(body);
      assert.equal(invalid.status, 400);
      await invalid.text();
    }
  });

  await t.test('frontend sitemap work consumes the backend-defined shared quota', async () => {
    for (let i = 0; i < 10; i++) {
      const accepted = await send({ policy: 'sitemap', clientKey: 'b'.repeat(64) });
      assert.equal(accepted.status, 200);
      assert.equal((await accepted.json()).data.allowed, true);
    }
    const blocked = await send({ policy: 'sitemap', clientKey: 'b'.repeat(64) });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
    await blocked.text();
    const other = await send({ policy: 'sitemap', clientKey: 'c'.repeat(64) });
    assert.equal(other.status, 200);
    await other.text();
  });

  await t.test('different frontend visitors do not consume the ordinary 60-write egress quota', async () => {
    for (let index = 0; index < 65; index++) {
      const accepted = await send({ policy: 'public-job', clientKey: index.toString(16).padStart(64, '0') });
      assert.equal(accepted.status, 200, `visitor ${index}`);
      await accepted.text();
    }
  });
});

test('quota storage failures fail closed without leaking database errors', async () => {
  const store = new MongoRateLimitStore({ prefix: 'failure', model: { findOneAndUpdate: async () => { throw new Error('private-database-query'); } } });
  await assert.rejects(store.increment('client'), error => error.status === 503 && !error.message.includes('private-database-query'));
});
