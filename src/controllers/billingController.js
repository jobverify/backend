/**
 * @file Controllers for premium plan pricing, checkout, payment verification, and refunds.
 * @module controllers/billingController
 */

import User from "../models/User.js";
import {
  activateWebhookPurchase,
  BillingRequestError,
  buildBillingSummary,
  cancelActivePlan,
  createCheckout,
  failWebhookPurchase,
  listBillingPlans,
  reconcileWebhookRefund,
  verifyAndActivatePurchase,
} from "../services/planService.js";
import {
  getPaymentProvider,
  PaymentProviderError,
} from "../services/paymentProvider.js";

const toPublicPurchase = (purchase) => {
  if (!purchase) return purchase;

  const rawPurchase = typeof purchase.toJSON === "function"
    ? purchase.toJSON()
    : typeof purchase.toObject === "function"
      ? purchase.toObject()
      : { ...purchase };

  delete rawPurchase.providerSignature;
  delete rawPurchase.metadata;
  delete rawPurchase.__v;
  if (rawPurchase._id && !rawPurchase.id) {
    rawPurchase.id = rawPurchase._id;
  }
  return rawPurchase;
};

export const getBillingPlans = async (_req, res) => {
  res.status(200).json({
    code: 200,
    success: true,
    data: listBillingPlans(),
  });
};

export const createPlanCheckoutHandler = (checkoutService) => async (req, res) => {
  try {
    const result = await checkoutService({
      user: req.user,
      planId: req.body.planId,
    });

    return res.status(201).json({
      code: 201,
      success: true,
      message: "Checkout created successfully.",
      data: {
        purchase: toPublicPurchase(result.purchase),
        checkout: result.checkout,
      },
    });
  } catch (error) {
    const statusCode = error instanceof BillingRequestError
      ? 400
      : error instanceof PaymentProviderError && error.statusCode === 401
        ? 401
        : 500;
    return res.status(statusCode).json({
      code: statusCode,
      success: false,
      message: statusCode === 500
        ? "Unable to create checkout at this time."
        : error.message,
    });
  }
};

export const createPlanCheckout = createPlanCheckoutHandler(createCheckout);

const respondWithBillingError = (res, error, genericMessage) => {
  const statusCode = error instanceof BillingRequestError ? 400 : 500;
  return res.status(statusCode).json({
    code: statusCode,
    success: false,
    message: statusCode === 400 ? error.message : genericMessage,
  });
};

export const createCancelPlanHandler = (cancelPlan) => async (req, res) => {
  try {
    const result = await cancelPlan({ userId: req.user._id });
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Plan cancelled. Your account is now on the Free plan.",
      data: {
        access: result.access,
        accessRole: result.user.accessRole,
        accessEvent: result.accessEvent,
      },
    });
  } catch (error) {
    return respondWithBillingError(
      res,
      error,
      "Unable to cancel your plan at this time.",
    );
  }
};

export const cancelPlan = createCancelPlanHandler(cancelActivePlan);

export const verifyPlanCheckoutHandler = (verifyPurchase) => async (req, res) => {
  try {
    const result = await verifyPurchase({
      purchaseId: req.body.purchaseId,
      providerOrderId: req.body.providerOrderId,
      providerPaymentId: req.body.providerPaymentId,
      providerSignature: req.body.providerSignature,
      userId: req.user._id,
    });

    return res.status(200).json({
      code: 200,
      success: true,
      message: result.purchase.status === "refunded"
        ? "Purchase was refunded."
        : result.idempotent
        ? "Purchase was already activated."
        : "Purchase verified and activated successfully.",
      data: {
        purchase: toPublicPurchase(result.purchase),
        access: result.access,
        accessRole: result.user.accessRole,
      },
    });
  } catch (error) {
    return respondWithBillingError(
      res,
      error,
      "Unable to verify purchase at this time.",
    );
  }
};

export const verifyPlanCheckout = verifyPlanCheckoutHandler(verifyAndActivatePurchase);

export const handleBillingWebhookHandler = ({
  getProvider,
  activatePurchase,
  failPurchase = failWebhookPurchase,
  reconcileRefund = reconcileWebhookRefund,
}) => async (req, res) => {
  try {
    const provider = getProvider();
    const signature = req.headers["x-razorpay-signature"];

    if (
      !provider.verifyWebhook({
        rawBody: req.rawBody,
        signature,
      })
    ) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Webhook signature verification failed.",
      });
    }

    if (req.body?.event === "payment.captured") {
      const payload = req.body?.payload?.payment?.entity ?? {};
      if (!payload.order_id || !payload.id) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: "Webhook payment identifiers are required.",
        });
      }

      await activatePurchase({
        providerOrderId: payload.order_id,
        providerPaymentId: payload.id,
        provider: provider.name,
        payment: payload,
      });
    } else if (req.body?.event === "payment.failed") {
      await failPurchase({
        provider: provider.name,
        payment: req.body?.payload?.payment?.entity,
      });
    } else if (["refund.created", "refund.processed", "refund.failed"].includes(req.body?.event)) {
      await reconcileRefund({
        provider: provider.name,
        event: req.body.event,
        payment: req.body?.payload?.payment?.entity,
        refund: req.body?.payload?.refund?.entity,
      });
    }

    return res.status(200).json({
      code: 200,
      success: true,
    });
  } catch (error) {
    return respondWithBillingError(
      res,
      error,
      "Unable to process billing webhook at this time.",
    );
  }
};

export const handleBillingWebhook = handleBillingWebhookHandler({
  getProvider: getPaymentProvider,
  activatePurchase: activateWebhookPurchase,
});

export const getMyBillingSummary = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      code: 404,
      success: false,
      message: "User not found.",
    });
  }

  const summary = await buildBillingSummary(user);
  return res.status(200).json({
    code: 200,
    success: true,
    data: summary,
  });
};
