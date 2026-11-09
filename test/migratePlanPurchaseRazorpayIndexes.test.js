import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import mongoose from "mongoose";

import {
  PLAN_PURCHASE_RAZORPAY_INDEXES,
  runPlanPurchaseRazorpayIndexMigration,
} from "../scripts/migratePlanPurchaseRazorpayIndexes.js";
import * as migrationModule from "../scripts/migratePlanPurchaseRazorpayIndexes.js";

const execFileAsync = promisify(execFile);
const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const legacyIndexes = PLAN_PURCHASE_RAZORPAY_INDEXES.map(({ name, key }) => ({
  name,
  key,
  unique: true,
  sparse: true,
}));

test("PlanPurchase Razorpay index migration replaces only legacy sparse indexes", async () => {
  const dropped = [];
  const created = [];
  const collection = {
    async indexes() {
      return [{ name: "_id_", key: { _id: 1 } }, ...legacyIndexes];
    },
    async dropIndex(name) {
      dropped.push(name);
    },
    async createIndex(key, options) {
      created.push({ key, options });
    },
  };

  const result = await runPlanPurchaseRazorpayIndexMigration({
    apply: true,
    acknowledged: true,
    collection,
    log: () => {},
  });

  assert.deepEqual(result.replaced, PLAN_PURCHASE_RAZORPAY_INDEXES.map(({ name }) => name));
  assert.deepEqual(dropped, PLAN_PURCHASE_RAZORPAY_INDEXES.map(({ name }) => name));
  assert.deepEqual(created, PLAN_PURCHASE_RAZORPAY_INDEXES.map(({ key, options }) => ({ key, options })));
});

test("PlanPurchase Razorpay index migration plans changes without mutating indexes by default", async () => {
  const mutations = [];
  const collection = {
    async indexes() {
      return legacyIndexes;
    },
    async dropIndex(name) {
      mutations.push({ operation: "drop", name });
    },
    async createIndex(key, options) {
      mutations.push({ operation: "create", key, options });
    },
  };

  const result = await runPlanPurchaseRazorpayIndexMigration({
    collection,
    log: () => {},
  });

  assert.deepEqual(result.replaced, []);
  assert.deepEqual(result.planned, PLAN_PURCHASE_RAZORPAY_INDEXES.map(({ name }) => name));
  assert.deepEqual(mutations, []);
});

test("PlanPurchase Razorpay index migration requires explicit acknowledgement before applying changes", async () => {
  const mutations = [];
  const collection = {
    async indexes() {
      return legacyIndexes;
    },
    async dropIndex(name) {
      mutations.push({ operation: "drop", name });
    },
    async createIndex(key, options) {
      mutations.push({ operation: "create", key, options });
    },
  };

  await assert.rejects(
    runPlanPurchaseRazorpayIndexMigration({ apply: true, collection, log: () => {} }),
    /without explicit acknowledgement/i,
  );
  assert.deepEqual(mutations, []);
});

test("PlanPurchase Razorpay index migration refuses an unrecognised index with a legacy name", async () => {
  const collection = {
    async indexes() {
      return [{
        name: "provider_1_providerPaymentId_1",
        key: { provider: 1, providerPaymentId: -1 },
        unique: true,
      }];
    },
  };

  await assert.rejects(
    runPlanPurchaseRazorpayIndexMigration({ collection, log: () => {} }),
    /does not match the expected legacy sparse index/i,
  );
});

test("PlanPurchase Razorpay index migration refuses legacy-looking indexes with extra options", async () => {
  const collection = {
    async indexes() {
      return [{
        name: "provider_1_providerOrderId_1",
        key: { provider: 1, providerOrderId: 1 },
        unique: true,
        sparse: true,
        collation: { locale: "en" },
      }];
    },
  };

  await assert.rejects(
    runPlanPurchaseRazorpayIndexMigration({ collection, log: () => {} }),
    /does not match the expected legacy sparse index/i,
  );
});

test("PlanPurchase Razorpay index migration reports drift in desired indexes with extra options", async () => {
  const desiredPaymentIndex = PLAN_PURCHASE_RAZORPAY_INDEXES.find(
    ({ name }) => name === "provider_1_providerPaymentId_1",
  );
  const collection = {
    async indexes() {
      return [{
        name: desiredPaymentIndex.name,
        key: desiredPaymentIndex.key,
        unique: true,
        partialFilterExpression: desiredPaymentIndex.options.partialFilterExpression,
        hidden: true,
      }];
    },
  };

  await assert.rejects(
    runPlanPurchaseRazorpayIndexMigration({ collection, log: () => {} }),
    /does not match the expected legacy sparse index/i,
  );
});

test("PlanPurchase Razorpay index migration validates every target before replacing any index", async () => {
  const mutations = [];
  const collection = {
    async indexes() {
      return [
        legacyIndexes[0],
        {
          name: "provider_1_providerPaymentId_1",
          key: { provider: 1, providerPaymentId: -1 },
          unique: true,
        },
      ];
    },
    async dropIndex(name) {
      mutations.push({ operation: "drop", name });
    },
    async createIndex(key, options) {
      mutations.push({ operation: "create", key, options });
    },
  };

  await assert.rejects(
    runPlanPurchaseRazorpayIndexMigration({
      apply: true,
      acknowledged: true,
      collection,
      log: () => {},
    }),
    /does not match the expected legacy sparse index/i,
  );
  assert.deepEqual(mutations, []);
});

test("PlanPurchase Razorpay index migration helpers can be imported without database configuration", async () => {
  await execFileAsync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./scripts/migratePlanPurchaseRazorpayIndexes.js')"],
    {
      cwd: backendDirectory,
      env: {
        ...process.env,
        MONGO_URI: "",
      },
    },
  );
});

test("PlanPurchase Razorpay migration does not register models before CLI connection", () => {
  assert.equal(mongoose.models.PlanPurchase, undefined);
});

test("PlanPurchase Razorpay migration disables Mongoose automatic index and collection creation", () => {
  assert.equal(typeof migrationModule.configureMongooseForIndexMigration, "function");

  const isolatedMongoose = new mongoose.Mongoose();
  migrationModule.configureMongooseForIndexMigration(isolatedMongoose);

  assert.equal(isolatedMongoose.get("autoIndex"), false);
  assert.equal(isolatedMongoose.get("autoCreate"), false);
});

test("PlanPurchase Razorpay CLI rejects an unacknowledged apply before database configuration is loaded", async () => {
  const error = await execFileAsync(
      process.execPath,
      ["scripts/migratePlanPurchaseRazorpayIndexes.js", "--apply"],
      {
        cwd: backendDirectory,
        env: {
          ...process.env,
          MONGO_URI: "",
          JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS: "",
        },
      },
    ).then(
      () => assert.fail("Expected the migration CLI to reject an unacknowledged apply."),
      (reason) => reason,
    );

  assert.match(error.stderr, /without explicit acknowledgement/i);
  assert.doesNotMatch(error.stderr, /MONGO_URI/i);
});
