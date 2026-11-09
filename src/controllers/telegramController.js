/**
 * @file Authenticated Telegram Bot API webhook handling.
 * @module controllers/telegramController
 */

import { createHash, timingSafeEqual } from "node:crypto";
import TelegramLinkToken from "../models/TelegramLinkToken.js";
import User from "../models/User.js";
import { consumeTelegramLinkToken } from "../services/telegramLinkService.js";
import { getTelegramProvider } from "../services/telegramProvider.js";

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

const digestSecret = (value) =>
  createHash("sha256").update(String(value ?? "")).digest();

const secretsMatch = (provided, expected) =>
  timingSafeEqual(digestSecret(provided), digestSecret(expected));

const sendAccepted = (res) => res.status(200).json({ ok: true });

const revokeUnusedTelegramLinks = (userId, now = new Date()) =>
  TelegramLinkToken.updateMany(
    { user: userId, consumedAt: null },
    { $set: { consumedAt: now } },
  );

const sendTelegramMessage = (chatId, body) =>
  getTelegramProvider().sendTextMessage({ chatId: String(chatId), body });

export const verifyTelegramWebhookSecret = (req, res, next) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({
      success: false,
      message: "Telegram webhook is not configured.",
    });
  }

  const providedSecret = req.get?.(SECRET_HEADER)
    ?? req.headers?.[SECRET_HEADER.toLowerCase()];
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized Telegram webhook.",
    });
  }

  req.telegramWebhookVerified = true;
  return next();
};

const processVerifiedTelegramWebhook = async (req, res) => {
  const message = req.body?.message;
  if (message?.chat?.type !== "private") {
    return sendAccepted(res);
  }

  const text = typeof message.text === "string" ? message.text.trim() : "";
  const chatId = message.chat.id;
  if (chatId === undefined || chatId === null) {
    return sendAccepted(res);
  }

  const startMatch = text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{1,500})$/u);
  if (startMatch) {
    const userId = await consumeTelegramLinkToken(startMatch[1]);
    if (!userId) return sendAccepted(res);

    const linkedAt = new Date();
    let user;
    try {
      user = await User.findOneAndUpdate(
        { _id: userId, telegramAlertsAllowed: { $ne: false }, deactivated: { $ne: true }, accountDeletingAt: null },
        {
          $set: {
            "telegram.chatId": String(chatId),
            "telegram.username": message.chat.username
              ? String(message.chat.username).slice(0, 80)
              : null,
            "telegram.linkedAt": linkedAt,
            "telegram.optedOutAt": null,
          },
        },
        { new: true, runValidators: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;

      await sendTelegramMessage(
        chatId,
        "This Telegram chat is already linked to another JobVerify account.",
      );
      return sendAccepted(res);
    }

    if (!user) return sendAccepted(res);

    await sendTelegramMessage(chatId, "Your JobVerify Telegram alerts are linked.");
    return sendAccepted(res);
  }

  if (/^\/stop(?:@[A-Za-z0-9_]+)?$/u.test(text)) {
    const optedOutAt = new Date();
    const user = await User.findOneAndUpdate(
      { "telegram.chatId": String(chatId) },
      {
        $set: {
          "telegram.chatId": null,
          "telegram.username": null,
          "telegram.linkedAt": null,
          "telegram.optedOutAt": optedOutAt,
          "premium.telegramAlertsEnabled": false,
        },
      },
      { new: true },
    );
    if (user) await revokeUnusedTelegramLinks(user._id, optedOutAt);
  }

  return sendAccepted(res);
};

export const processTelegramWebhook = async (req, res) => {
  if (req.telegramWebhookVerified) {
    return processVerifiedTelegramWebhook(req, res);
  }

  return verifyTelegramWebhookSecret(
    req,
    res,
    () => processVerifiedTelegramWebhook(req, res),
  );
};
