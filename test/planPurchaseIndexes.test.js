import assert from "node:assert/strict";
import test from "node:test";

import PlanPurchase from "../src/models/PlanPurchase.js";

const findIndex = (field) => PlanPurchase.schema.indexes().find(([key]) => (
  key.provider === 1 && key[field] === 1
));

test("PlanPurchase indexes only resolved Razorpay identifiers so pending checkouts do not collide", () => {
  const expectedIndexes = [
    {
      field: "providerOrderId",
      name: "provider_1_providerOrderId_1",
    },
    {
      field: "providerPaymentId",
      name: "provider_1_providerPaymentId_1",
    },
  ];

  for (const { field, name } of expectedIndexes) {
    const [, options] = findIndex(field) ?? [];

    assert.equal(options?.unique, true);
    assert.equal(options?.sparse, undefined);
    assert.equal(options?.name, name);
    assert.deepEqual(options?.partialFilterExpression, {
      [field]: { $type: "string" },
    });
  }
});
