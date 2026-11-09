import assert from "node:assert/strict";
import test from "node:test";
import {
  EntitlementLineageError,
  planEntitlementContributionRemoval,
} from "../src/services/entitlementRemoval.js";

const activeUser = (overrides = {}) => ({
  accessRole: "semester_premium_user",
  contact: {},
  premium: {
    planId: "semester",
    status: "active",
    startedAt: new Date("2026-09-12T00:00:00.000Z"),
    expiresAt: new Date("2027-01-12T00:00:00.000Z"),
    lastPurchase: "reward",
    telegramAlertsEnabled: false,
    ...overrides,
  },
});

const purchase = ({ id, status, planId = "semester", startsAt, expiresAt, metadata = {} }) => ({
  _id: id,
  status,
  planId,
  startsAt: new Date(startsAt),
  expiresAt: new Date(expiresAt),
  metadata,
});

const removalOptions = {
  now: new Date("2026-09-12T00:00:00.000Z"),
  contributingStatuses: ["paid", "legacy_reward"],
  lineageStatuses: ["paid", "refunded", "legacy_reward"],
};

test("removing the only active contribution projects free access", () => {
  const plan = planEntitlementContributionRemoval({
    user: activeUser(),
    purchases: [purchase({
      id: "reward",
      status: "legacy_reward",
      startsAt: "2026-09-12T00:00:00.000Z",
      expiresAt: "2027-01-12T00:00:00.000Z",
    })],
    targetPurchaseId: "reward",
    ...removalOptions,
  });

  assert.equal(plan.outcome, "free");
  assert.equal(plan.userPatch.accessRole, "free_user");
  assert.equal(plan.userPatch.premium.lastPurchase, null);
  assert.equal(plan.deactivateSubscription, true);
});

test("removing a reward shifts a later paid duration forward without deleting it", () => {
  const reward = purchase({
    id: "reward",
    status: "legacy_reward",
    startsAt: "2026-09-12T00:00:00.000Z",
    expiresAt: "2027-01-12T00:00:00.000Z",
  });
  const paid = purchase({
    id: "paid",
    status: "paid",
    planId: "monthly",
    startsAt: "2027-01-12T00:00:00.000Z",
    expiresAt: "2027-02-12T00:00:00.000Z",
    metadata: { entitlementBefore: {
      lastPurchase: "reward",
      planId: "semester",
      startedAt: reward.startsAt,
      expiresAt: reward.expiresAt,
    } },
  });

  const plan = planEntitlementContributionRemoval({
    user: activeUser({
      lastPurchase: "paid",
      planId: "monthly",
      startedAt: paid.startsAt,
      expiresAt: paid.expiresAt,
    }),
    purchases: [reward, paid],
    targetPurchaseId: "reward",
    ...removalOptions,
  });

  assert.equal(plan.outcome, "active");
  assert.equal(plan.userPatch.premium.lastPurchase, "paid");
  assert.equal(plan.purchasePatches.length, 1);
  assert.equal(plan.purchasePatches[0].id, "paid");
  assert.equal(plan.purchasePatches[0].startsAt.toISOString(), "2026-09-12T00:00:00.000Z");
  assert.equal(plan.purchasePatches[0].expiresAt.toISOString(), "2026-10-13T00:00:00.000Z");
  assert.equal(
    +plan.purchasePatches[0].expiresAt - +plan.purchasePatches[0].startsAt,
    +paid.expiresAt - +paid.startsAt,
  );
});

test("an independently changed premium snapshot is left unchanged", () => {
  const reward = purchase({
    id: "reward",
    status: "legacy_reward",
    startsAt: "2026-09-12T00:00:00.000Z",
    expiresAt: "2027-01-12T00:00:00.000Z",
  });
  const plan = planEntitlementContributionRemoval({
    user: activeUser({ planId: "yearly", expiresAt: new Date("2027-09-12T00:00:00.000Z") }),
    purchases: [reward],
    targetPurchaseId: "reward",
    ...removalOptions,
  });

  assert.equal(plan.outcome, "unchanged");
  assert.equal(plan.userPatch, null);
  assert.deepEqual(plan.purchasePatches, []);
});

test("ambiguous contiguous predecessors are rejected", () => {
  const commonEnd = "2027-01-12T00:00:00.000Z";
  const latest = purchase({
    id: "latest",
    status: "paid",
    planId: "monthly",
    startsAt: commonEnd,
    expiresAt: "2027-02-12T00:00:00.000Z",
  });

  assert.throws(() => planEntitlementContributionRemoval({
    user: activeUser({
      lastPurchase: "latest",
      planId: "monthly",
      startedAt: latest.startsAt,
      expiresAt: latest.expiresAt,
    }),
    purchases: [
      purchase({ id: "reward", status: "legacy_reward", startsAt: "2026-09-12T00:00:00.000Z", expiresAt: commonEnd }),
      purchase({ id: "other", status: "paid", startsAt: "2026-12-12T00:00:00.000Z", expiresAt: commonEnd }),
      latest,
    ],
    targetPurchaseId: "reward",
    ...removalOptions,
  }), EntitlementLineageError);
});

test("cyclic explicit lineage is rejected", () => {
  const first = purchase({
    id: "first",
    status: "paid",
    startsAt: "2026-11-12T00:00:00.000Z",
    expiresAt: "2026-12-12T00:00:00.000Z",
    metadata: { entitlementBefore: {
      lastPurchase: "second",
      planId: "semester",
      startedAt: new Date("2026-12-12T00:00:00.000Z"),
      expiresAt: new Date("2027-01-12T00:00:00.000Z"),
    } },
  });
  const second = purchase({
    id: "second",
    status: "paid",
    startsAt: "2026-12-12T00:00:00.000Z",
    expiresAt: "2027-01-12T00:00:00.000Z",
    metadata: { entitlementBefore: {
      lastPurchase: "first",
      planId: "semester",
      startedAt: first.startsAt,
      expiresAt: first.expiresAt,
    } },
  });

  assert.throws(() => planEntitlementContributionRemoval({
    user: activeUser({
      lastPurchase: "second",
      startedAt: second.startsAt,
      expiresAt: second.expiresAt,
    }),
    purchases: [
      purchase({ id: "reward", status: "legacy_reward", startsAt: "2026-09-12T00:00:00.000Z", expiresAt: "2026-11-12T00:00:00.000Z" }),
      first,
      second,
    ],
    targetPurchaseId: "reward",
    ...removalOptions,
  }), EntitlementLineageError);
});
