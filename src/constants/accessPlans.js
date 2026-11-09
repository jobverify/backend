/**
 * @file Centralized monetization plan constants and configuration.
 * @module constants/accessPlans
 */

export const ACCESS_ROLES = Object.freeze({
  FREE: "free_user",
  MONTHLY: "monthly_premium_user",
  SEMESTER: "semester_premium_user",
  YEARLY: "yearly_premium_user",
});

export const PLAN_IDS = Object.freeze({
  FREE: "free",
  MONTHLY: "monthly",
  SEMESTER: "semester",
  YEARLY: "yearly",
});

export const PLAN_CONFIG = Object.freeze({
  [PLAN_IDS.FREE]: {
    id: PLAN_IDS.FREE,
    name: "Free",
    priceInr: 0,
    durationMonths: null,
    accessRole: ACCESS_ROLES.FREE,
    hasFilters: false,
    hasAds: true,
    hasTelegramAlerts: false,
  },
  [PLAN_IDS.MONTHLY]: {
    id: PLAN_IDS.MONTHLY,
    name: "Monthly Premium",
    priceInr: 99,
    durationMonths: 1,
    accessRole: ACCESS_ROLES.MONTHLY,
    hasFilters: true,
    hasAds: false,
    hasTelegramAlerts: false,
  },
  [PLAN_IDS.SEMESTER]: {
    id: PLAN_IDS.SEMESTER,
    name: "Semester Premium",
    priceInr: 299,
    durationMonths: 3,
    accessRole: ACCESS_ROLES.SEMESTER,
    hasFilters: true,
    hasAds: false,
    hasTelegramAlerts: true,
  },
  [PLAN_IDS.YEARLY]: {
    id: PLAN_IDS.YEARLY,
    name: "Yearly Premium",
    priceInr: 999,
    durationMonths: 12,
    accessRole: ACCESS_ROLES.YEARLY,
    hasFilters: true,
    hasAds: false,
    hasTelegramAlerts: true,
  },
});

export const PREMIUM_PLAN_IDS = Object.freeze([
  PLAN_IDS.MONTHLY,
  PLAN_IDS.SEMESTER,
  PLAN_IDS.YEARLY,
]);

export const PREMIUM_ACCESS_ROLES = Object.freeze([
  ACCESS_ROLES.MONTHLY,
  ACCESS_ROLES.SEMESTER,
  ACCESS_ROLES.YEARLY,
]);

export const ACCESS_ROLE_TO_PLAN_ID = Object.freeze({
  [ACCESS_ROLES.FREE]: PLAN_IDS.FREE,
  [ACCESS_ROLES.MONTHLY]: PLAN_IDS.MONTHLY,
  [ACCESS_ROLES.SEMESTER]: PLAN_IDS.SEMESTER,
  [ACCESS_ROLES.YEARLY]: PLAN_IDS.YEARLY,
});
