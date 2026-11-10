/**
 * @file Helpers for deriving current user access entitlements.
 * @module utils/accessControl
 */

import {
  ACCESS_ROLE_TO_PLAN_ID,
  ACCESS_ROLES,
  PLAN_CONFIG,
  PLAN_IDS,
  PREMIUM_ACCESS_ROLES,
} from "../constants/accessPlans.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getStoredPlanId = (user) => {
  const premiumPlanId = user?.premium?.planId;
  if (premiumPlanId && PLAN_CONFIG[premiumPlanId]) {
    return premiumPlanId;
  }

  return ACCESS_ROLE_TO_PLAN_ID[user?.accessRole] ?? PLAN_IDS.FREE;
};

export const isAccessExpired = (user, now = new Date()) => {
  const expiresAt = user?.premium?.expiresAt;
  if (!expiresAt) return false;

  const planId = getStoredPlanId(user);
  if (!PREMIUM_ACCESS_ROLES.includes(user?.accessRole) && planId === PLAN_IDS.FREE) {
    return false;
  }

  return new Date(expiresAt).getTime() <= now.getTime();
};

export const applyExpiredAccessDowngrade = (user, now = new Date()) => {
  if (!user || !isAccessExpired(user, now)) {
    return false;
  }

  user.accessRole = ACCESS_ROLES.FREE;
  user.premium ??= {};
  user.premium.planId = PLAN_IDS.FREE;
  user.premium.status = "expired";
  user.premium.telegramAlertsEnabled = false;

  return true;
};

export const getEffectiveAccess = (user, now = new Date(), siteSettings) => {
  const safeUser = user ?? {};
  const isAdmin = safeUser.role === "admin";
  const expired = isAccessExpired(safeUser, now);
  const storedAccessRole = safeUser.accessRole ?? ACCESS_ROLES.FREE;
  const accessRole = expired ? ACCESS_ROLES.FREE : storedAccessRole;
  const planId = expired ? PLAN_IDS.FREE : getStoredPlanId(safeUser);
  const planConfig = PLAN_CONFIG[planId] ?? PLAN_CONFIG[PLAN_IDS.FREE];
  const isPremium = isAdmin || (planId !== PLAN_IDS.FREE && !expired);
  const canUseFilters = isAdmin || Boolean(planConfig.hasFilters && !expired);
  const shouldShowAdsValue = !isAdmin && Boolean(planConfig.hasAds || expired);
  const telegramLinkedAt = safeUser?.telegram?.linkedAt;
  const telegramOptedOutAt = safeUser?.telegram?.optedOutAt;
  const hasLinkedTelegram = Boolean(
    safeUser?.telegram?.chatId
    && telegramLinkedAt
    && (!telegramOptedOutAt
      || new Date(telegramLinkedAt).getTime() > new Date(telegramOptedOutAt).getTime()),
  );
  const canUseTelegram =
    safeUser.telegramAlertsAllowed !== false
    && (siteSettings?.billingEnabled === false || isAdmin || (!expired && planConfig.hasTelegramAlerts && safeUser?.premium?.status === "active"))
    && Boolean(safeUser?.premium?.telegramAlertsEnabled)
    && hasLinkedTelegram;

  return {
    accessRole,
    planId,
    planConfig,
    isAdmin,
    isPremium,
    isExpired: expired,
    status: expired ? "expired" : (safeUser?.premium?.status ?? "inactive"),
    expiresAt: safeUser?.premium?.expiresAt ?? null,
    canUseFilters,
    shouldShowAds: shouldShowAdsValue,
    canUseTelegramAlerts: canUseTelegram,
  };
};

export const canUsePremiumFilters = (user, now = new Date(), siteSettings) =>
  siteSettings?.billingEnabled === false || getEffectiveAccess(user, now).canUseFilters;

export const shouldShowAds = (user, now = new Date()) =>
  getEffectiveAccess(user, now).shouldShowAds;

export const canUseTelegramAlerts = (user, now = new Date(), siteSettings) =>
  getEffectiveAccess(user, now, siteSettings).canUseTelegramAlerts;

export const buildAccessSummary = (user, now = new Date()) => {
  const access = getEffectiveAccess(user, now);
  const expiresAt = access.expiresAt ? new Date(access.expiresAt) : null;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY))
    : 0;

  return {
    accessRole: access.accessRole,
    planId: access.planId,
    isPremium: access.isPremium,
    canUseFilters: access.canUseFilters,
    canSkipAds: !access.shouldShowAds,
    telegramAlertsAllowed: user?.telegramAlertsAllowed !== false,
    hasTelegramAlerts: user?.telegramAlertsAllowed !== false
      && (access.isAdmin || Boolean(access.planConfig.hasTelegramAlerts && !access.isExpired && access.status === "active")),
    expiresAt,
    daysRemaining,
    status: access.status,
  };
};
