/**
 * @file Shared helpers for admin-managed plan/access updates.
 * @module utils/adminPlanAccess
 */

import {
  ACCESS_ROLE_TO_PLAN_ID,
  ACCESS_ROLES,
  PLAN_CONFIG,
  PLAN_IDS,
} from "../constants/accessPlans.js";

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const parseManualExpiry = (expiresAt) => {
  if (!expiresAt) {
    return null;
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid plan expiry specified.");
  }

  return parsed;
};

const resolveBaseStart = (user, now) => {
  const currentExpiry = user?.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
  const hasActivePremium =
    user?.premium?.status === "active"
    && currentExpiry
    && currentExpiry.getTime() > now.getTime();

  return hasActivePremium ? currentExpiry : now;
};

export const buildAdminManagedAccessState = ({
  user,
  accessRole,
  expiresAt = null,
  now = new Date(),
}) => {
  if (!Object.values(ACCESS_ROLES).includes(accessRole)) {
    throw new Error("Invalid plan role specified.");
  }

  const planId = ACCESS_ROLE_TO_PLAN_ID[accessRole] ?? PLAN_IDS.FREE;
  const planConfig = PLAN_CONFIG[planId] ?? PLAN_CONFIG[PLAN_IDS.FREE];

  if (planId === PLAN_IDS.FREE) {
    return {
      accessRole: ACCESS_ROLES.FREE,
      premium: {
        planId: PLAN_IDS.FREE,
        status: "inactive",
        startedAt: null,
        expiresAt: null,
        telegramAlertsEnabled: false,
      },
    };
  }

  const startedAt = new Date(resolveBaseStart(user, now));
  const manualExpiry = parseManualExpiry(expiresAt);
  const nextExpiry = manualExpiry ?? addMonths(startedAt, planConfig.durationMonths);

  return {
    accessRole,
    premium: {
      planId,
      status: "active",
      startedAt,
      expiresAt: nextExpiry,
      telegramAlertsEnabled: planConfig.hasTelegramAlerts && Boolean(user?.premium?.telegramAlertsEnabled),
    },
  };
};
