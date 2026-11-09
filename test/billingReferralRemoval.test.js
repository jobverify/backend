import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import PlanPurchase from "../src/models/PlanPurchase.js";
import AccessEvent from "../src/models/AccessEvent.js";
import AdminAudit from "../src/models/AdminAudit.js";
import { createPlanCheckoutHandler } from "../src/controllers/billingController.js";
import { buildBillingSummary } from "../src/services/planService.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("checkout forwards only the selected plan and authenticated user", async () => {
  let received;
  const handler = createPlanCheckoutHandler(async (input) => {
    received = input;
    return {
      purchase: { _id: "purchase-1", status: "pending" },
      checkout: { provider: "mock" },
    };
  });
  const user = { _id: "user-1" };
  const res = createResponse();

  await handler({ user, body: { planId: "monthly", referralCode: "LEGACY" } }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(received, { user, planId: "monthly" });
});

test("billing summary contains access, purchases, and access history", async () => {
  const originalFind = PlanPurchase.find;
  const originalEventFind = AccessEvent.find;
  const originalAuditFind = AdminAudit.find;
  const legacyCodeModel = mongoose.models.ReferralCode;
  const originalLegacyFind = legacyCodeModel?.findOne;

  PlanPurchase.find = () => ({
    sort() { return this; },
    limit() { return this; },
    lean() { return this; },
    async exec() { return []; },
  });
  AccessEvent.find = PlanPurchase.find;
  AdminAudit.find = PlanPurchase.find;
  if (legacyCodeModel) {
    legacyCodeModel.findOne = () => ({
      lean() { return this; },
      async exec() { return null; },
    });
  }

  try {
    const summary = await buildBillingSummary({
      _id: "user-1",
      accessRole: "free_user",
      premium: { planId: "free", status: "inactive", expiresAt: null },
    });
    assert.deepEqual(Object.keys(summary).sort(), ["access", "accessEvents", "purchases"]);
  } finally {
    PlanPurchase.find = originalFind;
    AccessEvent.find = originalEventFind;
    AdminAudit.find = originalAuditFind;
    if (legacyCodeModel) legacyCodeModel.findOne = originalLegacyFind;
  }
});

test("purchase schema rejects retired reward status and legacy attribution fields", () => {
  assert.equal(PlanPurchase.schema.path("referralCodeUsed"), undefined);
  assert.equal(PlanPurchase.schema.path("referredBy"), undefined);
  const statuses = PlanPurchase.schema.path("status").enumValues;
  assert.equal(statuses.includes("free_referral"), false);
  const providers = PlanPurchase.schema.path("provider").enumValues;
  assert.equal(providers.includes("manual"), false);
});
