import express from "express";
import {
  processTelegramWebhook,
  verifyTelegramWebhookSecret,
} from "../controllers/telegramController.js";
import { requireJsonMutation } from "../middleware/validateRequest.js";
import { createRateLimiter } from "../utils/rateLimit.js";

const router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(200).json({ ok: true }),
});

router.post(
  "/webhook",
  verifyTelegramWebhookSecret,
  webhookLimiter,
  requireJsonMutation,
  express.json({ limit: "32kb" }),
  processTelegramWebhook,
);

export default router;
