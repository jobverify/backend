/**
 * @file Payment provider abstraction for plan purchases.
 * @module services/paymentProvider
 */

import crypto from "node:crypto";
import Razorpay from "razorpay";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const normalizeProviderName = (value) => String(value || "mock")
  .trim()
  .toLowerCase();

const isMockPaymentsAllowed = (env = process.env) =>
  String(env.NODE_ENV || "").trim().toLowerCase() !== "production"
  && (String(env.NODE_ENV || "").trim().toLowerCase() === "test"
    || TRUE_VALUES.has(String(env.ALLOW_MOCK_PAYMENTS || "").trim().toLowerCase()));

const assertMockPaymentsAllowed = (env = process.env) => {
  if (!isMockPaymentsAllowed(env)) {
    throw new Error(
      "Mock payments are disabled. Configure a live payment provider or set ALLOW_MOCK_PAYMENTS=true for local development.",
    );
  }
};

const createMockProvider = (env = process.env) => ({
  name: "mock",
  async createCheckoutOrder({ purchase, planConfig, user }) {
    assertMockPaymentsAllowed(env);
    return {
      provider: "mock",
      providerOrderId: `mock_order_${purchase._id}`,
      checkout: {
        provider: "mock",
        providerOrderId: `mock_order_${purchase._id}`,
        amount: planConfig.priceInr,
        currency: "INR",
        note: `Mock checkout for ${user.email}`,
      },
    };
  },
  verifyPayment() {
    assertMockPaymentsAllowed(env);
    return { verified: true };
  },
  verifyWebhook() {
    return isMockPaymentsAllowed(env);
  },
});

export class PaymentProviderError extends Error {
  constructor(message, { statusCode = 500 } = {}) {
    super(message);
    this.name = "PaymentProviderError";
    this.statusCode = statusCode === 401 ? 401 : 500;
  }
}

const createProviderOrderError = (error) => {
  const providerStatus = error?.statusCode ?? error?.status;
  const isAuthenticationFailure = providerStatus === 401;
  return new PaymentProviderError(
    isAuthenticationFailure
      ? "Payment provider authentication failed."
      : "Failed to create payment order.",
    { statusCode: isAuthenticationFailure ? 401 : 500 },
  );
};

const createProviderConfigurationError = () => new PaymentProviderError(
  "Payment provider is not configured.",
);

export const createRazorpayProvider = ({
  createClient = (options) => new Razorpay(options),
  fetchImpl = globalThis.fetch,
} = {}) => ({
  name: "razorpay",
  async createCheckoutOrder({ purchase, planConfig, user }) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw createProviderOrderError();
    }

    const amount = Number(planConfig.priceInr) * 100;
    if (!Number.isInteger(amount) || amount < 100) {
      throw new Error("Razorpay order amount must be an integer of at least 100 paise.");
    }

    let data;
    try {
      const razorpay = createClient({
        key_id: keyId,
        key_secret: keySecret,
      });
      data = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: String(purchase._id),
        notes: {
          email: user.email,
          planId: purchase.planId,
        },
      });
    } catch (error) {
      throw createProviderOrderError(error);
    }

    if (!data?.id) {
      throw createProviderOrderError();
    }

    return {
      provider: "razorpay",
      providerOrderId: data.id,
      checkout: {
        provider: "razorpay",
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        keyId,
        name: "Jobverify",
        description: `${planConfig.name} access`,
      },
    };
  },
  async fetchPayment({ providerPaymentId }) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw createProviderConfigurationError();
    if (typeof providerPaymentId !== 'string' || !/^[a-zA-Z0-9_]{1,128}$/.test(providerPaymentId)) {
      throw new PaymentProviderError('Unable to verify payment status.');
    }
    try {
      const response = await fetchImpl(`https://api.razorpay.com/v1/payments/${providerPaymentId}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Payment lookup failed.');
      return await response.json();
    } catch {
      throw new PaymentProviderError('Unable to verify payment status.');
    }
  },
  verifyPayment({ providerOrderId, providerPaymentId, providerSignature }) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw createProviderConfigurationError();
    }

    if (
      typeof providerSignature !== "string"
      || !/^[a-f0-9]{64}$/.test(providerSignature)
    ) {
      return { verified: false };
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest();
    const receivedSignature = Buffer.from(providerSignature, "hex");

    return {
      verified: expectedSignature.length === receivedSignature.length
        && crypto.timingSafeEqual(expectedSignature, receivedSignature),
    };
  },
  verifyWebhook({ rawBody, signature }) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw createProviderConfigurationError();
    }

    if (
      !rawBody
      || typeof signature !== "string"
      || !/^[a-f0-9]{64}$/.test(signature)
    ) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest();
    const receivedSignature = Buffer.from(signature, "hex");

    return expectedSignature.length === receivedSignature.length
      && crypto.timingSafeEqual(expectedSignature, receivedSignature);
  },
});

export const getPaymentProviderName = (env = process.env) =>
  normalizeProviderName(env.PAYMENT_PROVIDER);

export const getPaymentProvider = (
  name,
  env = process.env,
  razorpayOptions = {},
) => {
  const providerName = typeof name === "string" && name.trim()
    ? normalizeProviderName(name)
    : getPaymentProviderName(env);

  if (providerName === "razorpay") {
    return createRazorpayProvider(razorpayOptions);
  }

  if (providerName === 'mock') return createMockProvider(env);
  throw new PaymentProviderError('Unsupported payment provider.');
};
export { isMockPaymentsAllowed };
