import express from "express";
import { requireBillingEnabled } from "../middleware/siteSettings.js";
import {
  cancelPlan,
  createPlanCheckout,
  getBillingPlans,
  getMyBillingSummary,
  handleBillingWebhook,
  verifyPlanCheckout,
} from "../controllers/billingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { createRateLimiter, createApiRateLimitHandler } from '../utils/rateLimit.js';
import { validateRequest } from "../middleware/validateRequest.js";
import {
  billingCheckoutValidation,
  billingVerifyValidation,
} from "../validation/requestValidators.js";

const router = express.Router();

router.get("/plans", requireBillingEnabled, getBillingPlans);
router.post("/webhook", createRateLimiter({
  storePrefix: 'billing-webhook', windowMs: 60_000, limit: 300,
  standardHeaders: true, legacyHeaders: false,
  handler: createApiRateLimitHandler({ message: 'Too many webhook deliveries. Please retry shortly.' }),
}), handleBillingWebhook);

router.use(protect);
router.post("/cancel", cancelPlan);
router.get("/me", getMyBillingSummary);
router.post(
  "/checkout",
  requireBillingEnabled,
  billingCheckoutValidation,
  validateRequest,
  createPlanCheckout,
);
router.post(
  "/verify",
  billingVerifyValidation,
  validateRequest,
  verifyPlanCheckout,
);

export default router;
