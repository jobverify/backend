import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import PlanPurchase from "../src/models/PlanPurchase.js";

const createResponseDouble = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const serializePayload = (payload) => JSON.parse(JSON.stringify(payload));

test("cancelPlan returns free access after a successful cancellation", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=cancel-success-${Date.now()}`);
  const cancelPlan = controller.createCancelPlanHandler(async () => ({
    user: { accessRole: "free_user" },
    access: { planId: "free", isPremium: false },
    accessEvent: { id: "event-1", type: "cancelled", planId: "monthly" },
  }));
  const res = createResponseDouble();

  await cancelPlan({ user: { _id: "user_1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.accessRole, "free_user");
  assert.equal(res.body.data.access.planId, "free");
  assert.equal(res.body.data.accessEvent.type, "cancelled");
});

test("cancelPlan returns a safe 400 for an ineligible plan", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=cancel-ineligible-${Date.now()}`);
  const { BillingRequestError } = await import("../src/services/planService.js");
  const cancelPlan = controller.createCancelPlanHandler(async () => {
    throw new BillingRequestError("No active paid plan to cancel.");
  });
  const res = createResponseDouble();

  await cancelPlan({ user: { _id: "user_1" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "No active paid plan to cancel.");
});

test("handleBillingWebhook rejects an invalid Razorpay webhook signature", async () => {
  const originalProvider = process.env.PAYMENT_PROVIDER;
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.PAYMENT_PROVIDER = "razorpay";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";

  try {
    const { handleBillingWebhook } = await import(`../src/controllers/billingController.js?case=invalid-${Date.now()}`);
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test",
            order_id: "order_test",
          },
        },
      },
    });
    const res = createResponseDouble();

    await handleBillingWebhook(
      {
        body: JSON.parse(rawBody),
        rawBody,
        headers: {
          "x-razorpay-signature": "invalid_signature",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Webhook signature verification failed.");
  } finally {
    process.env.PAYMENT_PROVIDER = originalProvider;
    process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

test("handleBillingWebhook rejects mock-provider events when mock payments are disabled", async () => {
  const originalProvider = process.env.PAYMENT_PROVIDER;
  const originalMockPayments = process.env.ALLOW_MOCK_PAYMENTS;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.ALLOW_MOCK_PAYMENTS = "false";
  process.env.NODE_ENV = "production";

  try {
    const { handleBillingWebhook } = await import(`../src/controllers/billingController.js?case=mock-${Date.now()}`);
    const res = createResponseDouble();

    await handleBillingWebhook(
      {
        body: { event: "payment.captured", payload: { payment: { entity: {} } } },
        rawBody: "{}",
        headers: {},
      },
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Webhook signature verification failed.");
  } finally {
    process.env.PAYMENT_PROVIDER = originalProvider;
    process.env.ALLOW_MOCK_PAYMENTS = originalMockPayments;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("handleBillingWebhook accepts a valid Razorpay webhook signature for non-payment events", async () => {
  const originalProvider = process.env.PAYMENT_PROVIDER;
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.PAYMENT_PROVIDER = "razorpay";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";

  try {
    const { handleBillingWebhook } = await import(`../src/controllers/billingController.js?case=valid-${Date.now()}`);
    const rawBody = JSON.stringify({
      event: "payment.authorized",
      payload: {},
    });
    const signature = crypto
      .createHmac("sha256", "whsec_test")
      .update(rawBody)
      .digest("hex");
    const res = createResponseDouble();

    await handleBillingWebhook(
      {
        body: JSON.parse(rawBody),
        rawBody,
        headers: {
          "x-razorpay-signature": signature,
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  } finally {
    process.env.PAYMENT_PROVIDER = originalProvider;
    process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

test("createPlanCheckout hides untyped infrastructure and configuration failures", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=checkout-errors-${Date.now()}`);
  assert.equal(typeof controller.createPlanCheckoutHandler, "function");

  const cases = [
    {
      error: new Error("Purchase lookup failed with topology details"),
    },
    {
      error: new Error("Purchase create failed with database details"),
    },
    {
      error: new Error("Purchase save failed with database details"),
    },
    {
      error: new Error("Razorpay order amount must be an integer of at least 100 paise"),
    },
    {
      error: Object.assign(new Error("Razorpay secret is not configured"), {
        statusCode: 401,
      }),
    },
    {
      error: Object.assign(new Error("Provider secret should not be exposed"), {
        statusCode: 500,
      }),
    },
  ];

  for (const { error } of cases) {
    const res = createResponseDouble();
    const createPlanCheckout = controller.createPlanCheckoutHandler(async () => {
      throw error;
    });

    await createPlanCheckout(
      { user: { _id: "user_1" }, body: { planId: "monthly" } },
      res,
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.code, 500);
    assert.equal(res.body.message, "Unable to create checkout at this time.");
    assert.equal(JSON.stringify(res.body).includes(error.message), false);
  }
});

test("createPlanCheckout preserves known client input failures as safe 400 responses", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=checkout-client-error-${Date.now()}`);
  const { BillingRequestError } = await import("../src/services/planService.js");
  const createPlanCheckout = controller.createPlanCheckoutHandler(async () => {
    throw new BillingRequestError("Unsupported plan selected for checkout.");
  });
  const res = createResponseDouble();

  await createPlanCheckout(
    { user: { _id: "user_1" }, body: { planId: "unsupported" } },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 400);
  assert.equal(res.body.message, "Unsupported plan selected for checkout.");
});

test("createPlanCheckout preserves marked provider authentication failures as safe 401 responses", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=checkout-provider-auth-${Date.now()}`);
  const { PaymentProviderError } = await import("../src/services/paymentProvider.js");
  assert.equal(typeof PaymentProviderError, "function");
  const createPlanCheckout = controller.createPlanCheckoutHandler(async () => {
    throw new PaymentProviderError(
      "Payment provider authentication failed.",
      { statusCode: 401 },
    );
  });
  const res = createResponseDouble();

  await createPlanCheckout(
    { user: { _id: "user_1" }, body: { planId: "monthly" } },
    res,
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 401);
  assert.equal(res.body.message, "Payment provider authentication failed.");
});

test("createPlanCheckout does not expose stored payment signature or metadata", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=checkout-redact-purchase-${Date.now()}`);
  const createPlanCheckout = controller.createPlanCheckoutHandler(async () => ({
    purchase: {
      _id: "purchase_1",
      planId: "monthly",
      accessRole: "monthly_premium_user",
      amount: 99,
      currency: "INR",
      status: "pending",
      provider: "razorpay",
      providerOrderId: "order_1",
      providerPaymentId: null,
      providerSignature: "a".repeat(64),
      metadata: {
        checkout: {
          keyId: "razorpay_internal_key",
          order: { id: "order_1" },
        },
      },
      __v: 0,
    },
    checkout: {
      keyId: "rzp_live_public",
      order: { id: "order_1" },
    },
  }));
  const res = createResponseDouble();

  await createPlanCheckout(
    { user: { _id: "user_1" }, body: { planId: "monthly" } },
    res,
  );

  const publicBody = serializePayload(res.body);

  assert.equal(res.statusCode, 201);
  assert.equal(publicBody.data.purchase.providerOrderId, "order_1");
  assert.equal(publicBody.data.purchase.providerSignature, undefined);
  assert.equal(publicBody.data.purchase.metadata, undefined);
  assert.equal(publicBody.data.purchase.__v, undefined);
  assert.equal(publicBody.data.checkout.keyId, "rzp_live_public");
});

test("verifyPlanCheckout hides unexpected verification failures behind a generic 500", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=verify-server-error-${Date.now()}`);
  const rawErrorMessage = "Razorpay secret is not configured.";
  const verifyPlanCheckout = controller.verifyPlanCheckoutHandler(async () => {
    throw new Error(rawErrorMessage);
  });
  const res = createResponseDouble();

  await verifyPlanCheckout(
    {
      user: { _id: "user_1" },
      body: {
        purchaseId: "purchase_1",
        providerOrderId: "order_1",
        providerPaymentId: "payment_1",
        providerSignature: "signature_1",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 500);
  assert.equal(res.body.message, "Unable to verify purchase at this time.");
  assert.equal(JSON.stringify(res.body).includes(rawErrorMessage), false);
});

test("verifyPlanCheckout preserves safe 400 verification failures", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=verify-client-error-${Date.now()}`);
  const { BillingRequestError } = await import("../src/services/planService.js");
  const verifyPlanCheckout = controller.verifyPlanCheckoutHandler(async () => {
    throw new BillingRequestError("Payment verification failed.");
  });
  const res = createResponseDouble();

  await verifyPlanCheckout(
    {
      user: { _id: "user_1" },
      body: {
        purchaseId: "purchase_1",
        providerOrderId: "order_1",
        providerPaymentId: "payment_1",
        providerSignature: "invalid_signature",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 400);
  assert.equal(res.body.message, "Payment verification failed.");
});

test("verifyPlanCheckout does not expose stored payment signature or metadata", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=verify-redact-purchase-${Date.now()}`);
  const purchase = new PlanPurchase({
    user: "507f1f77bcf86cd799439011",
    planId: "monthly",
    accessRole: "monthly_premium_user",
    amount: 99,
    currency: "INR",
    status: "paid",
    provider: "razorpay",
    providerOrderId: "order_1",
    providerPaymentId: "payment_1",
    providerSignature: "a".repeat(64),
    metadata: {
      checkout: {
        keyId: "razorpay_internal_key",
        order: { id: "order_1" },
      },
      internalNote: "not-for-clients",
    },
  });
  const verifyPlanCheckout = controller.verifyPlanCheckoutHandler(async () => ({
    purchase,
    access: { planId: "monthly", isPremium: true },
    user: { accessRole: "monthly_premium_user" },
  }));
  const res = createResponseDouble();

  await verifyPlanCheckout(
    {
      user: { _id: "507f1f77bcf86cd799439011" },
      body: {
        purchaseId: String(purchase._id),
        providerOrderId: "order_1",
        providerPaymentId: "payment_1",
        providerSignature: "a".repeat(64),
      },
    },
    res,
  );

  const publicBody = serializePayload(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(publicBody.data.purchase.providerOrderId, "order_1");
  assert.equal(publicBody.data.purchase.providerPaymentId, "payment_1");
  assert.equal(publicBody.data.purchase.providerSignature, undefined);
  assert.equal(publicBody.data.purchase.metadata, undefined);
});

test("verifyPlanCheckout does not expose arbitrary upstream errors tagged 400", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=verify-provider-400-${Date.now()}`);
  const rawErrorMessage = "Provider transaction rejected with internal details";
  const verifyPlanCheckout = controller.verifyPlanCheckoutHandler(async () => {
    throw Object.assign(new Error(rawErrorMessage), { statusCode: 400 });
  });
  const res = createResponseDouble();

  await verifyPlanCheckout(
    {
      user: { _id: "user_1" },
      body: {
        purchaseId: "purchase_1",
        providerOrderId: "order_1",
        providerPaymentId: "payment_1",
        providerSignature: "signature_1",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Unable to verify purchase at this time.");
  assert.equal(JSON.stringify(res.body).includes(rawErrorMessage), false);
});

test("handleBillingWebhook hides activation failures behind a generic 500", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=webhook-server-error-${Date.now()}`);
  const rawErrorMessage = "MongoDB transaction aborted: topology details";
  const handleBillingWebhook = controller.handleBillingWebhookHandler({
    getProvider: () => ({
      verifyWebhook: () => true,
    }),
    activatePurchase: async () => {
      throw new Error(rawErrorMessage);
    },
  });
  const res = createResponseDouble();

  await handleBillingWebhook(
    {
      body: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "payment_1",
              order_id: "order_1",
            },
          },
        },
      },
      rawBody: "{}",
      headers: { "x-razorpay-signature": "signature_1" },
    },
    res,
  );

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 500);
  assert.equal(res.body.message, "Unable to process billing webhook at this time.");
  assert.equal(JSON.stringify(res.body).includes(rawErrorMessage), false);
});

test("handleBillingWebhook rejects captured payments missing provider identifiers", async () => {
  const controller = await import(`../src/controllers/billingController.js?case=webhook-missing-fields-${Date.now()}`);
  const handleBillingWebhook = controller.handleBillingWebhookHandler({
    getProvider: () => ({
      verifyWebhook: () => true,
    }),
    activatePurchase: async () => {
      throw new Error("activation must not run for an invalid payload");
    },
  });
  const res = createResponseDouble();

  await handleBillingWebhook(
    {
      body: {
        event: "payment.captured",
        payload: { payment: { entity: { id: "payment_1" } } },
      },
      rawBody: "{}",
      headers: { "x-razorpay-signature": "signature_1" },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 400);
  assert.equal(res.body.message, "Webhook payment identifiers are required.");
});
