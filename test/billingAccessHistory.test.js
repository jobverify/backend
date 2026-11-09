import assert from "node:assert/strict";
import test from "node:test";

import AdminAudit from "../src/models/AdminAudit.js";
import AccessEvent from "../src/models/AccessEvent.js";
import PlanPurchase from "../src/models/PlanPurchase.js";
import Subscription from "../src/models/Subscription.js";
import User from "../src/models/User.js";
import { buildBillingSummary, cancelActivePlan } from "../src/services/planService.js";

const queryWith = (result) => ({
  sort() { return this; },
  limit() { return this; },
  lean() { return this; },
  async exec() { return result; },
});

test("billing history includes cancellation events and older admin grants without calling them purchases", async () => {
  const purchaseFind = PlanPurchase.find;
  const eventFind = AccessEvent.find;
  const auditFind = AdminAudit.find;
  PlanPurchase.find = () => queryWith([{ _id: "purchase-1", planId: "monthly", amount: 99, currency: "INR", status: "paid", createdAt: new Date("2026-09-01") }]);
  AccessEvent.find = () => queryWith([{ _id: "event-1", type: "cancelled", planId: "monthly", occurredAt: new Date("2026-09-03") }]);
  AdminAudit.find = () => queryWith([{ _id: "audit-1", action: "updateUserAccess", timestamp: new Date("2026-09-02"), details: "Plan role changed from free_user (free) to semester_premium_user (semester) with expiry none -> 2027-01-01T00:00:00.000Z" }]);
  try {
    const summary = await buildBillingSummary({ _id: "user-1", accessRole: "free_user", premium: { planId: "free", status: "cancelled" } });
    assert.equal(summary.purchases[0].status, "paid");
    assert.deepEqual(summary.accessEvents.map(({ type, planId }) => ({ type, planId })), [
      { type: "cancelled", planId: "monthly" },
      { type: "admin_granted", planId: "semester" },
    ]);
  } finally {
    PlanPurchase.find = purchaseFind;
    AccessEvent.find = eventFind;
    AdminAudit.find = auditFind;
  }
});

test("cancelling premium records its former plan in the same transaction", async () => {
  const transaction = PlanPurchase.db.transaction;
  const findById = User.findById;
  const updateOne = Subscription.updateOne;
  const create = AccessEvent.create;
  const user = {
    _id: "user-1",
    accessRole: "monthly_premium_user",
    premium: { planId: "monthly", status: "active", startedAt: new Date("2026-09-01"), expiresAt: new Date("2026-10-01") },
    async save() {},
  };
  let recorded;
  PlanPurchase.db.transaction = async (callback) => callback({});
  User.findById = () => ({ session: async () => user });
  Subscription.updateOne = async () => ({});
  AccessEvent.create = async (events) => { recorded = events[0]; return events; };
  try {
    await cancelActivePlan({ userId: user._id });
    assert.equal(recorded.type, "cancelled");
    assert.equal(recorded.planId, "monthly");
    assert.equal(recorded.user, user._id);
    assert.equal(user.premium.status, "cancelled");
  } finally {
    PlanPurchase.db.transaction = transaction;
    User.findById = findById;
    Subscription.updateOne = updateOne;
    AccessEvent.create = create;
  }
});
