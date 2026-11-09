import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import JobAlertDelivery from "../src/models/JobAlertDelivery.js";
import TelegramLinkToken from "../src/models/TelegramLinkToken.js";
import {
  consumeTelegramLinkToken,
  createTelegramLinkToken,
} from "../src/services/telegramLinkService.js";

test("createTelegramLinkToken stores a SHA-256 hash rather than the raw link token", async () => {
  const originalCreate = TelegramLinkToken.create;
  const stored = [];
  const now = new Date("2026-08-16T12:00:00.000Z");
  TelegramLinkToken.create = async (payload) => {
    stored.push(payload);
    return payload;
  };

  try {
    const { rawToken, expiresAt } = await createTelegramLinkToken("user-1", now);

    assert.equal(stored.length, 1);
    assert.equal(stored[0].user, "user-1");
    assert.notEqual(stored[0].tokenHash, rawToken);
    assert.match(stored[0].tokenHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(expiresAt, new Date("2026-08-16T12:10:00.000Z"));
    assert.deepEqual(stored[0].expiresAt, new Date("2026-08-16T12:10:00.000Z"));
  } finally {
    TelegramLinkToken.create = originalCreate;
  }
});

test("consumeTelegramLinkToken atomically returns the user once for a still-valid link", async () => {
  const originalFindOneAndUpdate = TelegramLinkToken.findOneAndUpdate;
  const now = new Date("2026-08-16T12:00:00.000Z");
  const rawToken = "token-under-test";
  const unconsumedHash = createHash("sha256").update(rawToken).digest("hex");
  let available = true;
  TelegramLinkToken.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.tokenHash, unconsumedHash);
    assert.equal(filter.consumedAt, null);
    assert.deepEqual(filter.expiresAt, { $gt: now });
    assert.deepEqual(update, { $set: { consumedAt: now } });
    if (!available) return null;
    available = false;
    return { user: "user-1" };
  };

  try {
    assert.equal(await consumeTelegramLinkToken(rawToken, now), "user-1");
    assert.equal(await consumeTelegramLinkToken(rawToken, now), null);
  } finally {
    TelegramLinkToken.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("JobAlertDelivery accepts telegram as a delivery channel", () => {
  const delivery = new JobAlertDelivery({ user: "507f1f77bcf86cd799439011", job: "507f1f77bcf86cd799439012", channel: "telegram" });
  assert.equal(delivery.validateSync(), undefined);
});
