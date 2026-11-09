/**
 * @file Billing, activation, expiry, and refund workflows for access plans.
 * @module services/planService
 */

import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import PlanPurchase from "../models/PlanPurchase.js";
import AccessEvent from "../models/AccessEvent.js";
import AdminAudit from "../models/AdminAudit.js";
import {
  ACCESS_ROLES,
  PLAN_CONFIG,
  PLAN_IDS,
  PREMIUM_ACCESS_ROLES,
  PREMIUM_PLAN_IDS,
} from "../constants/accessPlans.js";
import {
  applyExpiredAccessDowngrade,
  buildAccessSummary,
} from "../utils/accessControl.js";
import { getPaymentProvider } from "./paymentProvider.js";
import { planEntitlementContributionRemoval } from "./entitlementRemoval.js";

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

export class BillingRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "BillingRequestError";
    this.statusCode = 400;
  }
}

const useSession = (query, session) => (session ? query.session(session) : query);

const createPublicPlanSummary = (plan) => ({
  id: plan.id,
  name: plan.name,
  priceInr: plan.priceInr,
  monthlyEquivalentInr: plan.durationMonths
    ? Math.round(plan.priceInr * 100 / plan.durationMonths) / 100
    : null,
  durationMonths: plan.durationMonths,
  accessRole: plan.accessRole,
  hasFilters: plan.hasFilters,
  hasAds: plan.hasAds,
  hasTelegramAlerts: plan.hasTelegramAlerts,
});

const assertPaidPlan = (planId) => {
  if (!PREMIUM_PLAN_IDS.includes(planId)) {
    throw new Error("Unsupported plan selected for checkout.");
  }
  return PLAN_CONFIG[planId];
};

const buildPurchaseSummary = (purchase) => ({
  id: purchase._id,
  planId: purchase.planId,
  accessRole: purchase.accessRole,
  amount: purchase.amount,
  currency: purchase.currency,
  status: purchase.status,
  provider: purchase.provider,
  providerOrderId: purchase.providerOrderId,
  providerPaymentId: purchase.providerPaymentId,
  startsAt: purchase.startsAt,
  expiresAt: purchase.expiresAt,
  failedAt: purchase.failedAt ?? null,
  refundedAt: purchase.refundedAt ?? null,
  refundedAmount: purchase.refundedAmount ?? 0,
  refunds: (purchase.refunds || []).map((refund) => ({
    providerRefundId: refund.providerRefundId,
    amount: refund.amountMinor / 100,
    currency: refund.currency,
    status: refund.status,
    receivedAt: refund.receivedAt,
    processedAt: refund.processedAt,
  })),
  createdAt: purchase.createdAt,
});

export const extendOrStartPlan = ({ user, planConfig, now = new Date() }) => {
  const currentExpiry = user?.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
  const baseStart =
    user?.premium?.status === "active"
    && currentExpiry
    && currentExpiry.getTime() > now.getTime()
      ? currentExpiry
      : now;

  return {
    startsAt: new Date(baseStart),
    expiresAt: addMonths(baseStart, planConfig.durationMonths),
  };
};

export const activatePlanForUser = async ({
  userId,
  planId,
  purchaseId = null,
  source = "purchase",
  now = new Date(),
  session = null,
}) => {
  const planConfig = assertPaidPlan(planId);
  const user = await useSession(User.findById(userId), session);
  if (!user) {
    throw new Error("User not found for plan activation.");
  }

  applyExpiredAccessDowngrade(user, now);
  // Keep the entitlement lineage on the purchase, never in public account data.
  // This also preserves legacy/manual time that has no PlanPurchase document.
  user.$locals ||= {};
  user.$locals.entitlementBefore = user.premium.status === "active"
    && user.premium.expiresAt > now
    ? {
      planId: user.premium.planId,
      startedAt: user.premium.startedAt,
      expiresAt: user.premium.expiresAt,
      lastPurchase: user.premium.lastPurchase,
    }
    : null;
  const schedule = extendOrStartPlan({ user, planConfig, now });

  user.accessRole = planConfig.accessRole;
  user.premium.planId = planId;
  user.premium.status = "active";
  user.premium.startedAt = schedule.startsAt;
  user.premium.expiresAt = schedule.expiresAt;
  user.premium.lastPurchase = purchaseId;
  user.premium.telegramAlertsEnabled =
    planConfig.hasTelegramAlerts && Boolean(user.premium.telegramAlertsEnabled);
  user.premium.activationSource = source;

  await user.save(session ? { session } : undefined);
  return user;
};

export const cancelActivePlan = async ({ userId }) => {
  return PlanPurchase.db.transaction(async (session) => {
    const user = await useSession(User.findById(userId), session);
    if (
      !user
      || !PREMIUM_ACCESS_ROLES.includes(user.accessRole)
      || user.premium?.status !== "active"
    ) {
      throw new BillingRequestError("No active paid plan to cancel.");
    }

    const cancelledPlanId = user.premium.planId;
    user.accessRole = ACCESS_ROLES.FREE;
    user.premium.planId = PLAN_IDS.FREE;
    user.premium.status = "cancelled";
    user.premium.startedAt = null;
    user.premium.expiresAt = null;
    user.premium.lastPurchase = null;

    await user.save({ session });
    const [event] = await AccessEvent.create([{
      user: user._id,
      type: "cancelled",
      planId: cancelledPlanId,
    }], { session });
    await Subscription.updateOne(
      { user: user._id },
      { $set: { isActive: false } },
      { session },
    );

    return {
      user,
      access: buildAccessSummary(user),
      accessEvent: {
        id: event._id,
        type: event.type,
        planId: event.planId,
        occurredAt: event.occurredAt,
      },
    };
  }, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
};

export const createCheckout = async ({ user, planId }) => {
  if (!PREMIUM_PLAN_IDS.includes(planId)) {
    throw new BillingRequestError("Unsupported plan selected for checkout.");
  }
  const planConfig = assertPaidPlan(planId);
  const provider = getPaymentProvider();

  const purchase = await PlanPurchase.create({
    user: user._id,
    planId,
    accessRole: planConfig.accessRole,
    amount: planConfig.priceInr,
    currency: "INR",
    status: "created",
    provider: provider.name,
  });

  let checkout;
  try {
    checkout = await provider.createCheckoutOrder({ purchase, planConfig, user });
  } catch (error) {
    // Never persist provider error bodies, credentials or payment instrument data.
    await PlanPurchase.updateOne(
      { _id: purchase._id, status: "created" },
      { $set: {
        status: "failed", failedAt: new Date(),
        "metadata.checkoutFailure": "provider_order_failed",
      } },
    );
    throw error;
  }

  purchase.provider = checkout.provider;
  purchase.providerOrderId = checkout.providerOrderId;
  purchase.status = "pending";
  purchase.metadata = {
    ...(purchase.metadata || {}),
    checkout: checkout.checkout,
  };
  await purchase.save();

  return {
    purchase,
    checkout: checkout.checkout,
  };
};

const finalizeVerifiedPurchase = async ({
  purchase,
  providerPaymentId,
  providerSignature = null,
  source = "payment_verification",
  now = new Date(),
}) => {
  const result = await PlanPurchase.db.transaction(async (session) => {
    const currentPurchase = await useSession(
      PlanPurchase.findOne({ _id: purchase._id }),
      session,
    );
    if (!currentPurchase) {
      throw new Error("Purchase not found.");
    }

    if (currentPurchase.providerPaymentId && providerPaymentId
      && currentPurchase.providerPaymentId !== providerPaymentId) {
      throw new BillingRequestError("Payment does not match this purchase.");
    }

    if (currentPurchase.status === "paid" || currentPurchase.status === "refunded") {
      const existingUser = await useSession(
        User.findById(currentPurchase.user),
        session,
      );
      return {
        purchase: currentPurchase,
        user: existingUser,
        access: buildAccessSummary(existingUser, now),
        idempotent: true,
      };
    }

    const updatedUser = await activatePlanForUser({
      userId: currentPurchase.user,
      planId: currentPurchase.planId,
      purchaseId: currentPurchase._id,
      source,
      now,
      session,
    });

    currentPurchase.status = "paid";
    currentPurchase.providerPaymentId =
      providerPaymentId || currentPurchase.providerPaymentId;
    if (providerSignature) {
      currentPurchase.providerSignature = providerSignature;
    }
    currentPurchase.startsAt = updatedUser.premium.startedAt;
    currentPurchase.expiresAt = updatedUser.premium.expiresAt;
    currentPurchase.metadata = {
      ...currentPurchase.metadata,
      entitlementBefore: updatedUser.$locals?.entitlementBefore ?? null,
    };
    await currentPurchase.save({ session });
    return {
      purchase: currentPurchase,
      user: updatedUser,
      access: buildAccessSummary(updatedUser, now),
      idempotent: false,
    };
  }, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });

  return result;
};

export const verifyAndActivatePurchase = async ({
  purchaseId,
  providerOrderId,
  providerPaymentId,
  providerSignature,
  userId,
  now = new Date(),
}, { getProvider = getPaymentProvider } = {}) => {
  if (!userId) throw new BillingRequestError("An authenticated purchase owner is required.");
  const purchase = await PlanPurchase.findOne(
    { ...(purchaseId ? { _id: purchaseId } : { providerOrderId }), user: userId },
  );

  if (!purchase) {
    throw new BillingRequestError("Purchase not found.");
  }

  if (String(purchase.user) !== String(userId)) {
    throw new BillingRequestError("Purchase does not belong to this user.");
  }

  if (
    providerOrderId
    && String(purchase.providerOrderId) !== String(providerOrderId)
  ) {
    throw new BillingRequestError("Payment order does not match this purchase.");
  }

  if (purchase.status === "paid" || purchase.status === "refunded") {
    return finalizeVerifiedPurchase({
      purchase,
      providerPaymentId,
      providerSignature,
      source: "payment_verification",
      now,
    });
  }

  const provider = getProvider(purchase.provider);
  const verification = await provider.verifyPayment({
    providerOrderId: purchase.providerOrderId,
    providerPaymentId,
    providerSignature,
  });
  if (!verification.verified) {
    throw new BillingRequestError("Payment verification failed.");
  }

  if (purchase.provider === 'razorpay') {
    const payment = await provider.fetchPayment({ providerPaymentId });
    if (payment?.id !== providerPaymentId) throw new BillingRequestError('Payment identifier does not match this purchase.');
    validateWebhookPayment(purchase, payment);
    if (payment.status !== 'captured') throw new BillingRequestError('Payment has not been captured. Please wait for processing to complete.');
  }

  return finalizeVerifiedPurchase({
    purchase,
    providerPaymentId,
    providerSignature,
    source: "payment_verification",
    now,
  });
};

export const activateWebhookPurchase = async ({
  providerOrderId,
  providerPaymentId,
  provider,
  payment,
  source = "payment_webhook",
  now = new Date(),
}) => {
  const purchase = await PlanPurchase.findOne({ providerOrderId, ...(provider ? { provider } : {}) });
  if (!purchase) {
    throw new BillingRequestError("Purchase not found for webhook event.");
  }

  if (payment) {
    validateWebhookPayment(purchase, payment);
    if (payment.status !== "captured") {
      throw new BillingRequestError("Webhook payment is not captured.");
    }
  }

  return finalizeVerifiedPurchase({
    purchase,
    providerPaymentId,
    source,
    now,
  });
};

const validProviderId = (value) => typeof value === "string"
  && /^[a-zA-Z0-9_]{1,128}$/.test(value);

const validateWebhookPayment = (purchase, payment) => {
  if (!validProviderId(payment?.id) || !validProviderId(payment?.order_id)) {
    throw new BillingRequestError("Webhook payment identifiers are required.");
  }
  const amountMinor = Math.round(purchase.amount * 100);
  if (payment.order_id !== purchase.providerOrderId
    || !Number.isSafeInteger(payment.amount)
    || payment.amount !== amountMinor
    || payment.currency !== purchase.currency) {
    throw new BillingRequestError("Webhook payment does not match the purchase amount, currency or order.");
  }
  return amountMinor;
};

const findWebhookPaymentPurchase = async ({ provider, payment, session }) => {
  if (provider !== "razorpay" || !validProviderId(payment?.order_id) || !validProviderId(payment?.id)) {
    throw new BillingRequestError("Webhook payment identifiers are required.");
  }
  const purchase = await useSession(PlanPurchase.findOne({
    provider, providerOrderId: payment.order_id,
  }), session);
  if (!purchase) throw new BillingRequestError("Purchase not found for webhook event.");
  validateWebhookPayment(purchase, payment);
  return purchase;
};

const webhookTransactionOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
};

export const failWebhookPurchase = async ({ provider = "razorpay", payment, now = new Date() }) =>
  PlanPurchase.db.transaction(async (session) => {
    const purchase = await findWebhookPaymentPurchase({ provider, payment, session });
    if (payment.status !== "failed") throw new BillingRequestError("Webhook payment is not failed.");
    if (!["created", "pending"].includes(purchase.status)) return { purchase, idempotent: true };
    purchase.status = "failed";
    purchase.failedAt = now;
    purchase.metadata = {
      ...purchase.metadata,
      lastPaymentFailure: { providerPaymentId: payment.id, receivedAt: now },
    };
    // An order may have several failed attempts before a different payment succeeds.
    await purchase.save({ session });
    return { purchase, idempotent: false };
  }, webhookTransactionOptions);

const revokeRefundedEntitlement = async ({ purchase, now, session }) => {
  const user = await useSession(User.findById(purchase.user), session);
  if (!user) throw new Error("User not found for refund reconciliation.");

  const purchases = await useSession(PlanPurchase.find({
    user: purchase.user, status: { $in: ["paid", "refunded"] },
  }), session);
  const plain = (document) => typeof document?.toObject === "function"
    ? document.toObject({ transform: false, depopulate: true })
    : { ...document };
  const removal = planEntitlementContributionRemoval({
    user: plain(user),
    purchases: purchases.map(plain),
    targetPurchaseId: purchase._id,
    now,
  });

  const purchasesById = new Map(purchases.map((item) => [String(item._id), item]));
  for (const patch of removal.purchasePatches) {
    const descendant = purchasesById.get(String(patch.id));
    if (!descendant) throw new Error("Entitlement purchase disappeared during refund reconciliation.");
    descendant.startsAt = patch.startsAt;
    descendant.expiresAt = patch.expiresAt;
    descendant.metadata = patch.metadata;
    await descendant.save({ session });
  }

  if (!removal.userPatch) return;
  user.accessRole = removal.userPatch.accessRole;
  user.premium = removal.userPatch.premium;
  if (removal.deactivateSubscription) {
    await Subscription.updateOne(
      { user: user._id },
      { $set: { isActive: false } },
      { session },
    );
  }
  await user.save({ session });
};

export const reconcileWebhookRefund = async ({
  provider = "razorpay", event, payment, refund, now = new Date(),
}) => PlanPurchase.db.transaction(async (session) => {
  const purchase = await findWebhookPaymentPurchase({ provider, payment, session });
  const amountMinor = Math.round(purchase.amount * 100);
  // Razorpay's documented refund.created payload can already be processed.
  const status = event === "refund.created" && ["pending", "processed"].includes(refund?.status)
    ? refund.status
    : { "refund.failed": "failed", "refund.processed": "processed" }[event];
  if (!status || !validProviderId(refund?.id) || refund.payment_id !== payment.id
    || (purchase.providerPaymentId && purchase.providerPaymentId !== payment.id)
    || !["captured", "refunded"].includes(payment.status)
    || refund.status !== status
    || !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || refund.amount > amountMinor
    || refund.currency !== purchase.currency
    || (payment.amount_refunded !== undefined && (!Number.isSafeInteger(payment.amount_refunded)
      || payment.amount_refunded < 0 || payment.amount_refunded > amountMinor))) {
    throw new BillingRequestError("Webhook refund does not match the payment, amount, currency or status.");
  }
  let recorded = purchase.refunds.find((item) => item.providerRefundId === refund.id);
  if (recorded && (recorded.amountMinor !== refund.amount || recorded.currency !== refund.currency)) {
    throw new BillingRequestError("Webhook refund conflicts with the recorded refund.");
  }
  const rank = { pending: 0, failed: 1, processed: 2 };
  if (recorded && rank[recorded.status] >= rank[status]) return { purchase, idempotent: true };
  if (!recorded) {
    purchase.refunds.push({
      providerRefundId: refund.id, amountMinor: refund.amount, currency: refund.currency,
      status, receivedAt: now, updatedAt: now,
    });
    recorded = purchase.refunds.at(-1);
  }
  recorded.status = status;
  recorded.updatedAt = now;
  if (status === "processed") recorded.processedAt = now;
  const totalMinor = purchase.refunds.reduce((total, item) => total + (item.status === "processed" ? item.amountMinor : 0), 0);
  if (!Number.isSafeInteger(totalMinor) || totalMinor > amountMinor) {
    throw new BillingRequestError("Total refunds exceed the purchase amount.");
  }
  purchase.providerPaymentId = payment.id;
  purchase.refundedAmount = totalMinor / 100;
  if (totalMinor === amountMinor && purchase.status !== "refunded") {
    await revokeRefundedEntitlement({ purchase, now, session });
    purchase.status = "refunded";
    purchase.refundedAt = now;
  }
  await purchase.save({ session });
  return { purchase, idempotent: false };
}, webhookTransactionOptions);

export const downgradeExpiredPlans = async (now = new Date()) => {
  const users = await User.find({
    accessRole: { $ne: ACCESS_ROLES.FREE },
    "premium.expiresAt": { $lte: now },
  });

  let downgraded = 0;
  for (const user of users) {
    if (applyExpiredAccessDowngrade(user, now)) {
      await user.save();
      await Subscription.updateOne(
        { user: user._id },
        { $set: { isActive: false } },
      ).catch(() => null);
      downgraded += 1;
    }
  }

  return downgraded;
};

export const buildBillingSummary = async (user) => {
  const [purchases, cancellations, adminChanges] = await Promise.all([
    PlanPurchase.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).lean().exec(),
    AccessEvent.find({ user: user._id }).sort({ occurredAt: -1 }).limit(10).lean().exec(),
    AdminAudit.find({ targetType: "User", targetId: user._id, action: "updateUserAccess" })
      .sort({ timestamp: -1 }).limit(10).lean().exec(),
  ]);

  const accessEvents = [
    ...cancellations.map((event) => ({
      id: event._id,
      type: event.type,
      planId: event.planId,
      occurredAt: event.occurredAt,
    })),
    ...adminChanges.flatMap((audit) => {
      // Older admin grants exist only as audit records with this detail format.
      const match = audit.details?.match(/to \S+ \((monthly|semester|yearly|free)\) with expiry .* -> (\S+)/);
      if (!match) return [];
      return [{
        id: audit._id,
        type: match[1] === PLAN_IDS.FREE ? "admin_removed" : "admin_granted",
        planId: match[1],
        expiresAt: match[2] === "none" ? null : match[2],
        occurredAt: audit.timestamp,
      }];
    }),
  ].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 10);

  if (user.premium?.status === "cancelled" && !accessEvents.some((event) => event.type === "cancelled")) {
    accessEvents.push({ id: "legacy-cancellation", type: "cancelled", planId: null, occurredAt: null });
  }

  return {
    access: buildAccessSummary(user),
    purchases: purchases.map(buildPurchaseSummary),
    accessEvents,
  };
};

export const listBillingPlans = () =>
  [PLAN_IDS.FREE, ...PREMIUM_PLAN_IDS].map((planId) =>
    createPublicPlanSummary(PLAN_CONFIG[planId]));
