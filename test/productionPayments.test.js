import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createRazorpayProvider } from '../src/services/paymentProvider.js';

function environment(t, overrides = {}) {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  Object.assign(process.env, { NODE_ENV: 'production', PAYMENT_PROVIDER: 'razorpay',
    RAZORPAY_KEY_ID: 'rzp_live_LaunchFixture123', RAZORPAY_KEY_SECRET: 'fixture-key-secret',
    RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook-secret', ...overrides });
}
const order = { purchase: { _id: 'purchase_fixture', planId: 'monthly' },
  planConfig: { name: 'Monthly', priceInr: 99 }, user: { email: 'synthetic@example.com' } };

for (const [name, overrides] of [
  ['sandbox key', { RAZORPAY_KEY_ID: 'rzp_test_LaunchFixture123' }],
  ['malformed live key', { RAZORPAY_KEY_ID: 'rzp_live_' }],
  ['missing webhook secret', { RAZORPAY_WEBHOOK_SECRET: '' }],
  ['blank webhook secret', { RAZORPAY_WEBHOOK_SECRET: '   ' }],
]) {
  test(`production checkout rejects ${name} before creating a provider order`, async t => {
    environment(t, overrides);
    let requests = 0;
    const provider = createRazorpayProvider({ createClient: () => ({ orders: { create: async () => {
      requests++; return { id: 'order_fixture', amount: 9900, currency: 'INR' };
    } } }) });
    await assert.rejects(provider.createCheckoutOrder(order), { message: 'Payment provider is not configured.' });
    assert.equal(requests, 0);
  });
}

test('a fully configured production checkout still creates a live-mode order', async t => {
  environment(t);
  const provider = createRazorpayProvider({ createClient: options => {
    assert.equal(options.key_id, 'rzp_live_LaunchFixture123');
    return { orders: { create: async request => {
      assert.equal(request.amount, 9900);
      return { id: 'order_live_fixture', amount: 9900, currency: 'INR' };
    } } };
  } });
  const result = await provider.createCheckoutOrder(order);
  assert.equal(result.providerOrderId, 'order_live_fixture');
  assert.equal(result.checkout.keyId, 'rzp_live_LaunchFixture123');
});

test('production rejects sandbox payment verification before lookup or entitlement approval', async t => {
  environment(t, { RAZORPAY_KEY_ID: 'rzp_test_LaunchFixture123' });
  const provider = createRazorpayProvider({ fetchImpl: () => assert.fail('sandbox lookup must not reach provider') });
  const providerSignature = createHmac('sha256', 'fixture-key-secret').update('order_fixture|pay_fixture').digest('hex');
  assert.throws(() => provider.verifyPayment({ providerOrderId: 'order_fixture', providerPaymentId: 'pay_fixture', providerSignature }),
    { message: 'Payment provider is not configured.' });
  await assert.rejects(provider.fetchPayment({ providerPaymentId: 'pay_fixture' }), { message: 'Payment provider is not configured.' });
});

test('settlement webhooks remain independently verifiable when new checkout is unavailable', t => {
  environment(t, { RAZORPAY_KEY_ID: '' });
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const signature = createHmac('sha256', 'fixture-webhook-secret').update(rawBody).digest('hex');
  assert.equal(createRazorpayProvider().verifyWebhook({ rawBody, signature }), true);
});
