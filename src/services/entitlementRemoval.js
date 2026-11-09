import {
  ACCESS_ROLES,
  PLAN_CONFIG,
  PLAN_IDS,
} from "../constants/accessPlans.js";

const id = (value) => value == null ? null : String(value);
const asDate = (value) => value == null ? null : new Date(value);
const unchanged = () => ({
  outcome: "unchanged",
  userPatch: null,
  purchasePatches: [],
  deactivateSubscription: false,
});

const snapshot = (purchase) => purchase ? {
  planId: purchase.planId,
  startedAt: asDate(purchase.startsAt),
  expiresAt: asDate(purchase.expiresAt),
  lastPurchase: purchase._id,
} : null;

const matchesSnapshot = (purchase, entitlement) => Boolean(
  purchase
  && entitlement
  && id(purchase._id) === id(entitlement.lastPurchase)
  && purchase.planId === entitlement.planId
  && +asDate(purchase.startsAt) === +asDate(entitlement.startedAt)
  && +asDate(purchase.expiresAt) === +asDate(entitlement.expiresAt)
);

export class EntitlementLineageError extends Error {
  constructor(message) {
    super(message);
    this.name = "EntitlementLineageError";
  }
}

export function planEntitlementContributionRemoval({
  user,
  purchases,
  targetPurchaseId,
  now = new Date(),
  contributingStatuses = ["paid"],
  lineageStatuses = ["paid", "refunded"],
}) {
  const eligible = purchases.filter((purchase) => lineageStatuses.includes(purchase.status));
  const byId = new Map(eligible.map((purchase) => [id(purchase._id), purchase]));
  const target = byId.get(id(targetPurchaseId));
  if (!target) {
    throw new EntitlementLineageError("Target purchase is missing from the entitlement set.");
  }
  if (user?.premium?.status !== "active" || !target.startsAt || !target.expiresAt) {
    return unchanged();
  }

  const latest = byId.get(id(user.premium.lastPurchase));
  if (!matchesSnapshot(latest, user.premium)) return unchanged();

  const resolvePrevious = (item) => {
    if (Object.hasOwn(item.metadata || {}, "entitlementBefore")) {
      const boundary = item.metadata.entitlementBefore;
      const previous = byId.get(id(boundary?.lastPurchase));
      return matchesSnapshot(previous, boundary)
        ? { purchase: previous, boundary: null }
        : { purchase: null, boundary: boundary || null };
    }

    const candidates = eligible.filter((candidate) => (
      id(candidate._id) !== id(item._id)
      && contributingStatuses.includes(candidate.status)
      && candidate.expiresAt
      && item.startsAt
      && +asDate(candidate.expiresAt) === +asDate(item.startsAt)
    ));
    if (candidates.length > 1) {
      throw new EntitlementLineageError(`Ambiguous predecessor for purchase ${id(item._id)}.`);
    }
    return { purchase: candidates[0] || null, boundary: null };
  };

  const descendants = [];
  const visited = new Set();
  let cursor = latest;
  while (cursor && id(cursor._id) !== id(target._id)) {
    if (visited.has(id(cursor._id))) {
      throw new EntitlementLineageError("Entitlement lineage contains a cycle.");
    }
    visited.add(id(cursor._id));
    descendants.unshift(cursor);
    const previous = resolvePrevious(cursor);
    if (previous.boundary) return unchanged();
    cursor = previous.purchase;
  }
  if (!cursor) return unchanged();

  const removedMs = Math.max(
    0,
    +asDate(target.expiresAt) - Math.max(+asDate(target.startsAt), +asDate(now)),
  );
  const predecessor = resolvePrevious(target);
  const before = predecessor.purchase && contributingStatuses.includes(predecessor.purchase.status)
    ? snapshot(predecessor.purchase)
    : predecessor.boundary;
  const purchasePatches = [];

  for (const [index, descendant] of descendants.entries()) {
    const startsAt = new Date(+asDate(descendant.startsAt) - removedMs);
    const expiresAt = new Date(+asDate(descendant.expiresAt) - removedMs);
    const previousPatch = purchasePatches[index - 1];
    const previousDescendant = descendants[index - 1];
    const metadata = {
      ...(descendant.metadata || {}),
      entitlementBefore: index === 0 ? before : {
        planId: previousDescendant.planId,
        startedAt: previousPatch.startsAt,
        expiresAt: previousPatch.expiresAt,
        lastPurchase: previousDescendant._id,
      },
      originalEntitlementWindow: descendant.metadata?.originalEntitlementWindow ?? {
        startsAt: asDate(descendant.startsAt),
        expiresAt: asDate(descendant.expiresAt),
      },
    };
    purchasePatches.push({ id: descendant._id, startsAt, expiresAt, metadata });
  }

  const finalDescendant = descendants.at(-1);
  const finalPatch = purchasePatches.at(-1);
  const remaining = finalPatch ? {
    planId: finalDescendant.planId,
    startedAt: finalPatch.startsAt,
    expiresAt: finalPatch.expiresAt,
    lastPurchase: finalDescendant._id,
  } : before;

  if (remaining && asDate(remaining.expiresAt) > asDate(now)) {
    const config = PLAN_CONFIG[remaining.planId];
    if (!config) throw new EntitlementLineageError(`Unknown plan ${remaining.planId}.`);
    return {
      outcome: "active",
      userPatch: {
        accessRole: config.accessRole,
        premium: {
          ...user.premium,
          planId: config.id,
          status: "active",
          startedAt: asDate(remaining.startedAt),
          expiresAt: asDate(remaining.expiresAt),
          lastPurchase: remaining.lastPurchase,
          telegramAlertsEnabled: config.hasTelegramAlerts
            && Boolean(user.premium.telegramAlertsEnabled),
        },
      },
      purchasePatches,
      deactivateSubscription: false,
    };
  }

  return {
    outcome: "free",
    userPatch: {
      accessRole: ACCESS_ROLES.FREE,
      premium: {
        ...user.premium,
        planId: PLAN_IDS.FREE,
        status: "cancelled",
        startedAt: null,
        expiresAt: null,
        lastPurchase: null,
        telegramAlertsEnabled: false,
      },
    },
    purchasePatches,
    deactivateSubscription: true,
  };
}

