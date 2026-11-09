import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

const modulePath = new URL("../src/services/paymentProvider.js", import.meta.url);

test('Razorpay capture lookup uses an authenticated bounded request and sanitizes provider failures', async () => {
  await withRazorpayCredentials(async () => {
    const { createRazorpayProvider } = await importPaymentProviderModule();
    const payment = { id: 'pay_fixture', order_id: 'order_fixture', status: 'captured', amount: 9900, currency: 'INR' };
    let fetched;
    const provider = createRazorpayProvider({ fetchImpl: async (url, options) => {
      fetched = url;
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from('rzp_test_key:test_secret').toString('base64')}`);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: true, json: async () => payment };
    } });
    assert.deepEqual(await provider.fetchPayment({ providerPaymentId: payment.id }), payment);
    assert.equal(fetched, `https://api.razorpay.com/v1/payments/${payment.id}`);
    const failing = createRazorpayProvider({ fetchImpl: async () => { throw new Error('private-provider-payload'); } });
    await assert.rejects(failing.fetchPayment({ providerPaymentId: payment.id }), error => error.message === 'Unable to verify payment status.' && !JSON.stringify(error).includes('private-provider-payload'));
  });
});

const importPaymentProviderModule = async (envOverrides = {}) => {
  const originalEnv = {
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    ALLOW_MOCK_PAYMENTS: process.env.ALLOW_MOCK_PAYMENTS,
    NODE_ENV: process.env.NODE_ENV,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  };

  Object.assign(process.env, envOverrides);

  try {
    return await import(`${modulePath.href}?t=${Date.now()}_${Math.random()}`);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const withRazorpayCredentials = async (run) => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";

  try {
    await run();
  } finally {
    if (originalKeyId === undefined) {
      delete process.env.RAZORPAY_KEY_ID;
    } else {
      process.env.RAZORPAY_KEY_ID = originalKeyId;
    }

    if (originalKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    }
  }
};

test("mock provider refuses to activate purchases without explicit opt-in", async () => {
  const { getPaymentProvider, isMockPaymentsAllowed } =
    await importPaymentProviderModule({
      PAYMENT_PROVIDER: "mock",
      ALLOW_MOCK_PAYMENTS: "",
      NODE_ENV: "development",
    });

  assert.equal(isMockPaymentsAllowed({
    PAYMENT_PROVIDER: "mock",
    ALLOW_MOCK_PAYMENTS: "",
    NODE_ENV: "development",
  }), false);

  const provider = getPaymentProvider("mock", {
    PAYMENT_PROVIDER: "mock",
    ALLOW_MOCK_PAYMENTS: "",
    NODE_ENV: "development",
  });

  await assert.rejects(
    provider.createCheckoutOrder({
      purchase: { _id: "purchase_1" },
      planConfig: { priceInr: 999 },
      user: { email: "dev@example.com" },
    }),
    /Mock payments are disabled/i,
  );

  assert.throws(
    () => provider.verifyPayment(),
    /Mock payments are disabled/i,
  );
  assert.equal(provider.verifyWebhook(), false);
});

test("mock provider can be enabled explicitly for local development", async () => {
  const { getPaymentProvider, isMockPaymentsAllowed } =
    await importPaymentProviderModule({
      PAYMENT_PROVIDER: "mock",
      ALLOW_MOCK_PAYMENTS: "true",
      NODE_ENV: "development",
    });

  assert.equal(isMockPaymentsAllowed({
    PAYMENT_PROVIDER: "mock",
    ALLOW_MOCK_PAYMENTS: "true",
    NODE_ENV: "development",
  }), true);

  const provider = getPaymentProvider("mock", {
    PAYMENT_PROVIDER: "mock",
    ALLOW_MOCK_PAYMENTS: "true",
    NODE_ENV: "development",
  });

  const checkout = await provider.createCheckoutOrder({
    purchase: { _id: "purchase_2" },
    planConfig: { priceInr: 1499 },
    user: { email: "dev@example.com" },
  });

  assert.equal(checkout.provider, "mock");
  assert.equal(checkout.providerOrderId, "mock_order_purchase_2");
  assert.deepEqual(provider.verifyPayment(), { verified: true });
  assert.equal(provider.verifyWebhook(), true);
});

test("Razorpay provider creates a paise order from the server plan price", async () => {
  let receivedOrder;
  let receivedOptions;
  const createClient = (options) => {
    receivedOptions = options;
    return {
      orders: {
        create: async (order) => {
          receivedOrder = order;
          return {
            id: "order_123",
            amount: 19900,
            currency: "INR",
          };
        },
      },
    };
  };

  await withRazorpayCredentials(async () => {
    const { getPaymentProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });

    const result = await getPaymentProvider("razorpay", process.env, {
      createClient,
    }).createCheckoutOrder({
      purchase: { _id: "purchase_199", planId: "premium" },
      planConfig: { priceInr: 199, name: "Premium" },
      user: { email: "member@example.com" },
    });

    assert.deepEqual(receivedOptions, {
      key_id: "rzp_test_key",
      key_secret: "test_secret",
    });
    assert.deepEqual(receivedOrder, {
      amount: 19900,
      currency: "INR",
      receipt: "purchase_199",
      notes: {
        email: "member@example.com",
        planId: "premium",
      },
    });
    assert.deepEqual(result.checkout, {
      provider: "razorpay",
      orderId: "order_123",
      amount: 19900,
      currency: "INR",
      keyId: "rzp_test_key",
      name: "Jobverify",
      description: "Premium access",
    });
  });
});

test("Razorpay provider rejects an order below 100 paise before invoking the SDK", async () => {
  let clientConstructed = 0;
  const createClient = () => {
    clientConstructed += 1;
    return { orders: { create: async () => undefined } };
  };

  await withRazorpayCredentials(async () => {
    const { getPaymentProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });

    await assert.rejects(
      getPaymentProvider("razorpay", process.env, {
        createClient,
      }).createCheckoutOrder({
        purchase: { _id: "purchase_low", planId: "premium" },
        planConfig: { priceInr: 0.009, name: "Premium" },
        user: { email: "member@example.com" },
      }),
      /at least 100 paise/i,
    );
    assert.equal(clientConstructed, 0);
  });
});

test("Razorpay provider marks upstream authentication failures as 401", async () => {
  const createClient = () => ({
    orders: {
      create: async () => {
        const error = new Error("Authentication failed");
        error.statusCode = 401;
        throw error;
      },
    },
  });

  await withRazorpayCredentials(async () => {
    const { getPaymentProvider, PaymentProviderError } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });
    assert.equal(typeof PaymentProviderError, "function");

    await assert.rejects(
      getPaymentProvider("razorpay", process.env, {
        createClient,
      }).createCheckoutOrder({
        purchase: { _id: "purchase_auth", planId: "premium" },
        planConfig: { priceInr: 199, name: "Premium" },
        user: { email: "member@example.com" },
      }),
      (error) => error instanceof PaymentProviderError
        && error.statusCode === 401
        && error.message === "Payment provider authentication failed.",
    );
  });
});

test("Razorpay provider marks non-authentication upstream failures as 500", async () => {
  const createClient = () => ({
    orders: {
      create: async () => {
        const error = new Error("Provider unavailable");
        error.statusCode = 503;
        throw error;
      },
    },
  });

  await withRazorpayCredentials(async () => {
    const { getPaymentProvider, PaymentProviderError } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });
    assert.equal(typeof PaymentProviderError, "function");

    await assert.rejects(
      getPaymentProvider("razorpay", process.env, {
        createClient,
      }).createCheckoutOrder({
        purchase: { _id: "purchase_error", planId: "premium" },
        planConfig: { priceInr: 199, name: "Premium" },
        user: { email: "member@example.com" },
      }),
      (error) => error instanceof PaymentProviderError
        && error.statusCode === 500
        && error.message === "Failed to create payment order.",
    );
  });
});

test("Razorpay provider treats missing credentials as a safe 500 provider failure", async () => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;

  try {
    const { getPaymentProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });

    await assert.rejects(
      getPaymentProvider("razorpay").createCheckoutOrder({
        purchase: { _id: "purchase_missing_keys", planId: "premium" },
        planConfig: { priceInr: 199, name: "Premium" },
        user: { email: "member@example.com" },
      }),
      (error) => error.statusCode === 500
        && error.message === "Failed to create payment order.",
    );
  } finally {
    if (originalKeyId === undefined) {
      delete process.env.RAZORPAY_KEY_ID;
    } else {
      process.env.RAZORPAY_KEY_ID = originalKeyId;
    }
    if (originalKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    }
  }
});

test("Razorpay provider marks a missing checkout verification secret as a 500 configuration failure", async () => {
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_KEY_SECRET;

  try {
    const { createRazorpayProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });

    assert.throws(
      () => createRazorpayProvider().verifyPayment({
        providerOrderId: "order_123",
        providerPaymentId: "payment_123",
        providerSignature: "a".repeat(64),
      }),
      (error) => error.statusCode === 500,
    );
  } finally {
    if (originalKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    }
  }
});

test("Razorpay provider distinguishes missing webhook configuration from an invalid signature", async () => {
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;

  try {
    const { createRazorpayProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });
    const provider = createRazorpayProvider();

    assert.throws(
      () => provider.verifyWebhook({
        rawBody: "{}",
        signature: "a".repeat(64),
      }),
      (error) => error.statusCode === 500,
    );
  } finally {
    if (originalWebhookSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
    }
  }
});

test("Razorpay provider verifies a valid checkout signature and rejects a tampered signature", async () => {
  const persistedOrderId = "order_server_created";
  const providerPaymentId = "pay_checkout_123";
  const validSignature = crypto
    .createHmac("sha256", "test_secret")
    .update(`${persistedOrderId}|${providerPaymentId}`)
    .digest("hex");
  const tamperedSignature = `${validSignature.slice(0, -1)}${
    validSignature.at(-1) === "0" ? "1" : "0"
  }`;
  const originalTimingSafeEqual = crypto.timingSafeEqual;
  const comparisons = [];
  crypto.timingSafeEqual = (expected, received) => {
    comparisons.push([expected.length, received.length]);
    return originalTimingSafeEqual(expected, received);
  };

  try {
    await withRazorpayCredentials(async () => {
      const { createRazorpayProvider } = await importPaymentProviderModule({
        PAYMENT_PROVIDER: "razorpay",
      });
      const provider = createRazorpayProvider();

      assert.deepEqual(provider.verifyPayment({
        providerOrderId: persistedOrderId,
        providerPaymentId,
        providerSignature: validSignature,
      }), { verified: true });
      assert.deepEqual(provider.verifyPayment({
        providerOrderId: persistedOrderId,
        providerPaymentId,
        providerSignature: tamperedSignature,
      }), { verified: false });
    });

    assert.deepEqual(comparisons, [[32, 32], [32, 32]]);
  } finally {
    crypto.timingSafeEqual = originalTimingSafeEqual;
  }
});

test("Razorpay provider rejects non-canonical checkout signature encodings", async () => {
  const persistedOrderId = "order_server_created";
  const providerPaymentId = "pay_checkout_123";
  const validSignature = crypto
    .createHmac("sha256", "test_secret")
    .update(`${persistedOrderId}|${providerPaymentId}`)
    .digest("hex");
  const malformedSignatures = [
    validSignature + "zz",
    validSignature + "a",
    `${validSignature.slice(0, 20)}zz${validSignature.slice(22)}`,
  ];

  await withRazorpayCredentials(async () => {
    const { createRazorpayProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });
    const provider = createRazorpayProvider();

    for (const providerSignature of malformedSignatures) {
      assert.deepEqual(provider.verifyPayment({
        providerOrderId: persistedOrderId,
        providerPaymentId,
        providerSignature,
      }), { verified: false });
    }
  });
});

test("Razorpay provider verifies webhook HMACs as canonical hex with a timing-safe comparison", async () => {
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const validSignature = crypto
    .createHmac("sha256", "webhook_test_secret")
    .update(rawBody)
    .digest("hex");
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const originalTimingSafeEqual = crypto.timingSafeEqual;
  const comparisons = [];
  crypto.timingSafeEqual = (expected, received) => {
    comparisons.push([expected.length, received.length]);
    return originalTimingSafeEqual(expected, received);
  };
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_test_secret";

  try {
    const { createRazorpayProvider } = await importPaymentProviderModule({
      PAYMENT_PROVIDER: "razorpay",
    });
    const provider = createRazorpayProvider();

    assert.equal(provider.verifyWebhook({ rawBody, signature: validSignature }), true);
    assert.equal(provider.verifyWebhook({ rawBody, signature: validSignature.toUpperCase() }), false);
    assert.equal(provider.verifyWebhook({ rawBody, signature: `${validSignature}00` }), false);
    assert.deepEqual(comparisons, [[32, 32]]);
  } finally {
    crypto.timingSafeEqual = originalTimingSafeEqual;
    if (originalWebhookSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
    }
  }
});
