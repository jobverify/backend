/**
 * @file Creates and atomically consumes Telegram account-linking tokens.
 * @module services/telegramLinkService
 */

import { createHash, randomBytes } from "node:crypto";
import TelegramLinkToken from "../models/TelegramLinkToken.js";

const LINK_TOKEN_TTL_MS = 600000;

const hashToken = (rawToken) => createHash("sha256").update(rawToken).digest("hex");

export const createTelegramLinkToken = async (userId, now = new Date()) => {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MS);

  await TelegramLinkToken.create({
    user: userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  return { rawToken, expiresAt };
};

export const consumeTelegramLinkToken = async (rawToken, now = new Date()) => {
  const token = await TelegramLinkToken.findOneAndUpdate(
    {
      tokenHash: hashToken(rawToken),
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
  );

  return token?.user ?? null;
};
