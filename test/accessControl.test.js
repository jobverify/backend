import assert from "node:assert/strict";
import test from "node:test";
import User from "../src/models/User.js";
import { ACCESS_ROLES, PLAN_IDS } from "../src/constants/accessPlans.js";
import {
  applyExpiredAccessDowngrade,
  buildAccessSummary,
  canUsePremiumFilters,
  canUseTelegramAlerts,
  getEffectiveAccess,
  shouldShowAds,
} from "../src/utils/accessControl.js";

test("free site mode permits opted-in linked users without a paid plan", () => {
  const settings = { billingEnabled: false };
  const user = {
    accessRole: ACCESS_ROLES.FREE,
    premium: { planId: PLAN_IDS.FREE, status: "inactive", telegramAlertsEnabled: true },
    telegram: { chatId: "123", linkedAt: new Date("2026-08-01") },
  };
  assert.equal(canUseTelegramAlerts(user, new Date(), settings), true);
  assert.equal(canUseTelegramAlerts(user, new Date(), { billingEnabled: true }), false);
  assert.equal(canUseTelegramAlerts({ ...user, premium: { ...user.premium, telegramAlertsEnabled: false } }, new Date(), settings), false);
  assert.equal(canUseTelegramAlerts({ ...user, telegram: {} }, new Date(), settings), false);
  assert.equal(canUseTelegramAlerts({ ...user, telegram: { ...user.telegram, optedOutAt: new Date("2026-08-02") } }, new Date(), settings), false);
});

test("User model defaults new accounts to Telegram alerts disabled", () => {
  const user = new User({ email: "student@example.com", password: "hashed-password" });
  assert.equal(user.accessRole, ACCESS_ROLES.FREE);
  assert.equal(user.premium.planId, PLAN_IDS.FREE);
  assert.equal(user.premium.telegramAlertsEnabled, false);
  assert.equal(Object.hasOwn(user.premium.toObject(), "whatsappAlertsEnabled"), false);
});

test("expired plans return users to the free plan and disable Telegram alerts", () => {
  const user = new User({
    email: "expired@example.com", password: "hashed-password", accessRole: ACCESS_ROLES.SEMESTER,
    premium: { planId: PLAN_IDS.SEMESTER, status: "active", expiresAt: new Date(Date.now() - 60_000), telegramAlertsEnabled: true },
  });
  assert.equal(applyExpiredAccessDowngrade(user), true);
  assert.equal(user.accessRole, ACCESS_ROLES.FREE);
  assert.equal(user.premium.telegramAlertsEnabled, false);
});

test("access summaries expose Telegram plan entitlement but no WhatsApp entitlement", () => {
  const user = new User({
    email: "premium@example.com", password: "hashed-password", accessRole: ACCESS_ROLES.YEARLY,
    premium: { planId: PLAN_IDS.YEARLY, status: "active", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  const summary = buildAccessSummary(user);
  assert.equal(summary.hasTelegramAlerts, true);
  assert.equal(Object.hasOwn(summary, "hasWhatsappAlerts"), false);
  assert.equal(canUsePremiumFilters(user), true);
  assert.equal(shouldShowAds(user), false);
});

test("Telegram delivery requires an active eligible plan, opt-in, and a linked chat", () => {
  const user = {
    accessRole: ACCESS_ROLES.SEMESTER,
    premium: { planId: PLAN_IDS.SEMESTER, status: "active", telegramAlertsEnabled: true },
    telegram: { chatId: "123", linkedAt: new Date("2026-08-01T00:00:00.000Z") },
  };
  assert.equal(canUseTelegramAlerts(user), true);
  assert.equal(canUseTelegramAlerts({ ...user, telegram: { chatId: "123", linkedAt: null } }), false);
  assert.equal(getEffectiveAccess({ ...user, premium: { ...user.premium, status: "inactive" } }).canUseTelegramAlerts, false);
});
