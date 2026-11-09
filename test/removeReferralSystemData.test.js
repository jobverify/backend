import assert from "node:assert/strict";
import test from "node:test";
import {
  configureMongooseForReferralRemoval,
  runReferralRemovalMigration,
} from "../scripts/removeReferralSystemData.js";

const activeUser = ({ lastPurchase, expiresAt }) => ({
  _id: "user",
  accessRole: "semester_premium_user",
  contact: {},
  premium: {
    planId: "semester",
    status: "active",
    startedAt: new Date("2026-09-12T00:00:00.000Z"),
    expiresAt,
    lastPurchase,
    telegramAlertsEnabled: false,
  },
});

const createMigrationStoreFixture = () => {
  const reward = {
    _id: "reward",
    user: "user",
    status: "free_referral",
    planId: "semester",
    startsAt: new Date("2026-09-12T00:00:00.000Z"),
    expiresAt: new Date("2027-01-12T00:00:00.000Z"),
    metadata: {},
  };
  const state = {
    rewards: [reward],
    user: activeUser({ lastPurchase: "reward", expiresAt: reward.expiresAt }),
    purchasesWithLegacyFields: 1,
    legacyPurchaseIndexes: ["referredBy_1"],
    collectionCounts: { referralcodes: 1, referralredemptions: 1 },
  };
  const mutations = [];
  const store = {
    databaseName: "migration_unit",
    async readInventory() {
      return {
        rewards: structuredClone(state.rewards),
        purchasesWithLegacyFields: state.purchasesWithLegacyFields,
        legacyPurchaseIndexes: [...state.legacyPurchaseIndexes],
        collectionCounts: { ...state.collectionCounts },
      };
    },
    async readEntitlement() {
      return {
        user: structuredClone(state.user),
        purchases: structuredClone(state.rewards),
      };
    },
    async withTransaction(work) { return work(store); },
    async applyEntitlementRemoval({ reward: removed, removal }) {
      mutations.push(["remove", removed._id, removal.outcome]);
      if (removal.userPatch) {
        state.user = { ...state.user, ...structuredClone(removal.userPatch) };
      }
      state.rewards = state.rewards.filter((item) => item._id !== removed._id);
    },
    async unsetLegacyPurchaseFields() {
      mutations.push(["unset"]);
      state.purchasesWithLegacyFields = 0;
    },
    async dropLegacyPurchaseIndexes() {
      mutations.push(["drop-index", "referredBy_1"]);
      state.legacyPurchaseIndexes = [];
    },
    async dropCollection(name) {
      mutations.push(["drop", name]);
      state.collectionCounts[name] = 0;
    },
  };
  return { mutations, state, store };
};

test("apply requires explicit acknowledgement before database access", async () => {
  let touched = false;
  await assert.rejects(
    runReferralRemovalMigration({
      apply: true,
      acknowledged: false,
      connection: { get db() { touched = true; return null; } },
    }),
    /JOBVERIFY_ACKNOWLEDGE_REFERRAL_REMOVAL=true/,
  );
  assert.equal(touched, false);
});

test("Mongoose automatic collection and index creation are disabled", () => {
  const settings = [];
  configureMongooseForReferralRemoval({ set: (...args) => settings.push(args) });
  assert.deepEqual(settings, [["autoIndex", false], ["autoCreate", false]]);
});

test("dry-run reports legacy data without opening a transaction or mutating collections", async () => {
  const fixture = createMigrationStoreFixture();
  const result = await runReferralRemovalMigration({
    store: fixture.store,
    now: new Date("2026-09-12T00:00:00.000Z"),
    log: () => {},
  });
  assert.equal(result.applied, false);
  assert.equal(result.database, "migration_unit");
  assert.equal(result.rewardPurchases, 1);
  assert.equal(result.affectedUsers, 1);
  assert.equal(result.projectedFreeUsers, 1);
  assert.deepEqual(fixture.mutations, []);
});

test("apply refuses all writes when preflight finds an invalid entitlement", async () => {
  const fixture = createMigrationStoreFixture();
  fixture.store.readEntitlement = async () => ({ user: null, purchases: [] });
  await assert.rejects(
    runReferralRemovalMigration({
      store: fixture.store,
      apply: true,
      acknowledged: true,
      log: () => {},
    }),
    /preflight/i,
  );
  assert.deepEqual(fixture.mutations, []);
});

test("missing retired collections are reported as empty", async () => {
  const fixture = createMigrationStoreFixture();
  fixture.state.collectionCounts = { referralcodes: 0, referralredemptions: 0 };
  const result = await runReferralRemovalMigration({ store: fixture.store, log: () => {} });
  assert.equal(result.referralCodeDocuments, 0);
  assert.equal(result.referralRedemptionDocuments, 0);
});

test("apply removes entitlements before fields and collections in dependency order", async () => {
  const fixture = createMigrationStoreFixture();
  const result = await runReferralRemovalMigration({
    store: fixture.store,
    apply: true,
    acknowledged: true,
    now: new Date("2026-09-12T00:00:00.000Z"),
    log: () => {},
  });
  assert.equal(result.applied, true);
  assert.deepEqual(fixture.mutations, [
    ["remove", "reward", "free"],
    ["unset"],
    ["drop-index", "referredBy_1"],
    ["drop", "referralredemptions"],
    ["drop", "referralcodes"],
  ]);
});

test("an applied cleanup is idempotent", async () => {
  const fixture = createMigrationStoreFixture();
  await runReferralRemovalMigration({
    store: fixture.store,
    apply: true,
    acknowledged: true,
    now: new Date("2026-09-12T00:00:00.000Z"),
    log: () => {},
  });
  const second = await runReferralRemovalMigration({ store: fixture.store, log: () => {} });
  assert.equal(second.rewardPurchases, 0);
  assert.equal(second.purchasesWithLegacyFields, 0);
  assert.deepEqual(second.legacyPurchaseIndexes, []);
  assert.equal(second.referralCodeDocuments, 0);
  assert.equal(second.referralRedemptionDocuments, 0);
});
