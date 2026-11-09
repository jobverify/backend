/**
 * @file Replaces legacy sparse Razorpay purchase indexes with partial unique indexes.
 * @module scripts/migratePlanPurchaseRazorpayIndexes
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";

export const PLAN_PURCHASE_RAZORPAY_INDEXES = [
  {
    name: "provider_1_providerOrderId_1",
    key: { provider: 1, providerOrderId: 1 },
    options: {
      name: "provider_1_providerOrderId_1",
      unique: true,
      partialFilterExpression: { providerOrderId: { $type: "string" } },
    },
  },
  {
    name: "provider_1_providerPaymentId_1",
    key: { provider: 1, providerPaymentId: 1 },
    options: {
      name: "provider_1_providerPaymentId_1",
      unique: true,
      partialFilterExpression: { providerPaymentId: { $type: "string" } },
    },
  },
];

const sameIndexKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const samePartialFilter = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const EXPECTED_INDEX_METADATA_FIELDS = new Set([
  "v",
  "key",
  "name",
  "ns",
  "background",
  "unique",
  "sparse",
  "partialFilterExpression",
]);

const hasOnlyExpectedIndexMetadata = (index) => (
  Object.keys(index).every((field) => EXPECTED_INDEX_METADATA_FIELDS.has(field))
);

const isLegacySparseIndex = (index, definition) => (
  index?.name === definition.name
  && sameIndexKey(index.key, definition.key)
  && index.unique === true
  && index.sparse === true
  && index.partialFilterExpression == null
  && hasOnlyExpectedIndexMetadata(index)
);

const isDesiredIndex = (index, definition) => (
  index?.name === definition.name
  && sameIndexKey(index.key, definition.key)
  && index.unique === true
  && index.sparse !== true
  && samePartialFilter(index.partialFilterExpression, definition.options.partialFilterExpression)
  && hasOnlyExpectedIndexMetadata(index)
);

const ensureApplyAcknowledged = ({ apply, acknowledged }) => {
  if (!apply) return;

  if (!acknowledged) {
    throw new Error(
      "Refusing to mutate PlanPurchase indexes without explicit acknowledgement.",
    );
  }
};

const findIndexByName = (indexes, name) => indexes.find((index) => index.name === name);

export const configureMongooseForIndexMigration = (mongooseInstance = mongoose) => {
  mongooseInstance.set("autoIndex", false);
  mongooseInstance.set("autoCreate", false);
};

export async function runPlanPurchaseRazorpayIndexMigration({
  apply = false,
  acknowledged = false,
  collection,
  log = console.log,
} = {}) {
  ensureApplyAcknowledged({ apply, acknowledged });
  const targetCollection = collection ?? (await import("../src/models/PlanPurchase.js")).default.collection;
  const existingIndexes = await targetCollection.indexes();
  const planned = [];
  const replaced = [];
  const created = [];
  const changes = [];

  for (const definition of PLAN_PURCHASE_RAZORPAY_INDEXES) {
    const existingIndex = findIndexByName(existingIndexes, definition.name);

    if (isDesiredIndex(existingIndex, definition)) {
      continue;
    }

    if (existingIndex && !isLegacySparseIndex(existingIndex, definition)) {
      throw new Error(
        `Index ${definition.name} does not match the expected legacy sparse index.`,
      );
    }

    changes.push({ definition, existingIndex });
  }

  for (const { definition, existingIndex } of changes) {
    planned.push(definition.name);
    log(
      `${apply ? "Replacing" : "Would replace"} ${definition.name} with a partial unique index.`,
    );

    if (!apply) {
      continue;
    }

    if (existingIndex) {
      await targetCollection.dropIndex(definition.name);
      replaced.push(definition.name);
    } else {
      created.push(definition.name);
    }
    await targetCollection.createIndex(definition.key, definition.options);
  }

  return { planned, replaced, created };
}

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

async function main() {
  const apply = process.argv.includes("--apply");
  const acknowledged = process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS === "true";

  try {
    ensureApplyAcknowledged({ apply, acknowledged });
    configureMongooseForIndexMigration();
    const [
      { default: connectDB },
      { default: PlanPurchase },
    ] = await Promise.all([
      import("../db/db.js"),
      import("../src/models/PlanPurchase.js"),
    ]);
    await connectDB();
    const result = await runPlanPurchaseRazorpayIndexMigration({
      apply,
      acknowledged,
      collection: PlanPurchase.collection,
    });
    console.log(JSON.stringify(result));
  } finally {
    await mongoose.disconnect();
  }
}

if (isDirectRun) {
  main().catch((error) => {
    console.error("PlanPurchase Razorpay index migration failed:", error.message);
    process.exitCode = 1;
  });
}
