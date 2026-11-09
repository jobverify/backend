import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { listBillingPlans, verifyAndActivatePurchase } from '../src/services/planService.js';
import { isMockPaymentsAllowed } from '../src/services/paymentProvider.js';
import PlanPurchase from '../src/models/PlanPurchase.js';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';

Object.assign(process.env, {
  NODE_ENV: 'test', JWT_SECRET: 'local-security-regression-secret-32-characters',
  CORS_ORIGIN: 'https://app.jobverify.test', PAYMENT_PROVIDER: 'razorpay',
  RAZORPAY_WEBHOOK_SECRET: 'local-webhook-fixture',
});

test('public plan prices include the server-calculated monthly equivalent', () => {
  const plans = listBillingPlans();
  assert.equal(plans.find(plan => plan.id === 'yearly').monthlyEquivalentInr, 83.25);
  assert.equal(plans.find(plan => plan.id === 'monthly').monthlyEquivalentInr, 99);
  assert.equal(plans.find(plan => plan.id === 'free').monthlyEquivalentInr, null);
});

test('production refuses mock payments even with the local opt-in flag', () => {
  assert.equal(isMockPaymentsAllowed({ NODE_ENV: 'production', ALLOW_MOCK_PAYMENTS: 'true' }), false);
});

test('unknown payment providers fail closed instead of falling through to mock', async () => {
  const { getPaymentProvider } = await import('../src/services/paymentProvider.js');
  assert.throws(() => getPaymentProvider('razorpya', { NODE_ENV: 'test' }), /unsupported payment provider/i);
});

test('browser and token privilege flags cannot override the current stored user', async t => {
  const { default: jwt } = await import('jsonwebtoken');
  const { protect, authorize } = await import('../src/middleware/authMiddleware.js');
  const { getEffectiveAccess } = await import('../src/utils/accessControl.js');
  const user = { _id: 'owner', role: 'user', accessRole: 'free_user', sessionVersion: 0, premium: { planId: 'free', status: 'inactive' } };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  const flags = { role: 'admin', isPro: true, isPremium: true, permissions: ['*'], accessRole: 'yearly_premium_user' };
  const req = { headers: { authorization: `Bearer ${jwt.sign({ id: 'owner', ...flags }, process.env.JWT_SECRET)}` }, body: flags, query: flags };
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let authenticated = false;
  await protect(req, res, () => { authenticated = true; });
  assert.equal(authenticated, true);
  authorize('admin')(req, res, () => assert.fail('Browser flags must not grant admin'));
  assert.equal(res.statusCode, 403);
  assert.equal(getEffectiveAccess(req.user).isPremium, false);
});

test('purchase verification requires an owner before reading or mutating a purchase', async t => {
  let reads = 0;
  t.mock.method(PlanPurchase, 'findOne', async () => { reads += 1; return null; });
  await assert.rejects(verifyAndActivatePurchase({ purchaseId: '665f47f5f65f3f4d2e1d1001' }), /authenticated purchase owner/i);
  assert.equal(reads, 0);
});

test('purchase lookup is scoped to the authenticated owner', async t => {
  let filter;
  t.mock.method(PlanPurchase, 'findOne', async query => { filter = query; return null; });
  await assert.rejects(verifyAndActivatePurchase({ purchaseId: '665f47f5f65f3f4d2e1d1001', userId: 'owner' }), /not found/i);
  assert.deepEqual(filter, { _id: '665f47f5f65f3f4d2e1d1001', user: 'owner' });
});

test('ingress limits malformed requests, webhooks and health checks before route handling', async () => {
  process.env.ENABLE_RATE_LIMITING = 'true';
  const { createApp } = await import('../src/app.js');
  const app = createApp({ ingressLimit: 2 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    await malformed.text();
    const body = JSON.stringify({ event: 'test.ignored' });
    const webhook = await fetch(`${base}/api/billing/webhook`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'x-razorpay-signature': createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex'),
    }, body });
    assert.equal(webhook.status, 200);
    await webhook.text();
    const blocked = await fetch(`${base}/health`);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
    assert.equal((await blocked.json()).error, 'rate_limited');
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete process.env.ENABLE_RATE_LIMITING;
  }
});
