import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { runReferralRemovalMigration } from "../../scripts/removeReferralSystemData.js";

process.env.MONGOMS_RUNTIME_DOWNLOAD = "false";
const binary = {
  version: process.env.MONGOMS_VERSION || "8.2.6",
  downloadDir: path.resolve(
    process.env.MONGOMS_DOWNLOAD_DIR
      || path.join(import.meta.dirname, "../../.cache/mongodb-binaries"),
  ),
};

test("migration dry-runs, preserves paid access, revokes reward access, and reruns safely", async () => {
  const replSet = await MongoMemoryReplSet.create({
    binary,
    instanceOpts: [{ launchTimeout: 60_000 }],
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const connection = await mongoose.createConnection(replSet.getUri(), {
    dbName: "referral_removal_integration",
    autoCreate: false,
    autoIndex: false,
  }).asPromise();

  try {
    const db = connection.db;
    const users = db.collection("users");
    const purchases = db.collection("planpurchases");
    const subscriptions = db.collection("subscriptions");
    const codes = db.collection("referralcodes");
    const redemptions = db.collection("referralredemptions");
    const rewardOnlyUserId = new mongoose.Types.ObjectId();
    const paidUserId = new mongoose.Types.ObjectId();
    const rewardOnlyId = new mongoose.Types.ObjectId();
    const paidRewardId = new mongoose.Types.ObjectId();
    const paidPurchaseId = new mongoose.Types.ObjectId();
    const now = new Date("2026-09-12T00:00:00.000Z");
    const rewardStart = new Date("2026-09-12T00:00:00.000Z");
    const rewardEnd = new Date("2027-01-12T00:00:00.000Z");
    const paidEnd = new Date("2027-02-12T00:00:00.000Z");

    await users.insertMany([
      {
        _id: rewardOnlyUserId,
        accessRole: "semester_premium_user",
        premium: {
          planId: "semester",
          status: "active",
          startedAt: rewardStart,
          expiresAt: rewardEnd,
          lastPurchase: rewardOnlyId,
          telegramAlertsEnabled: true,
        },
      },
      {
        _id: paidUserId,
        accessRole: "monthly_premium_user",
        premium: {
          planId: "monthly",
          status: "active",
          startedAt: rewardEnd,
          expiresAt: paidEnd,
          lastPurchase: paidPurchaseId,
          telegramAlertsEnabled: false,
        },
      },
    ]);
    await purchases.insertMany([
      {
        _id: rewardOnlyId,
        user: rewardOnlyUserId,
        status: "free_referral",
        planId: "semester",
        startsAt: rewardStart,
        expiresAt: rewardEnd,
        metadata: { reason: "referral_reward" },
      },
      {
        _id: paidRewardId,
        user: paidUserId,
        status: "free_referral",
        planId: "semester",
        startsAt: rewardStart,
        expiresAt: rewardEnd,
        metadata: { reason: "referral_reward" },
      },
      {
        _id: paidPurchaseId,
        user: paidUserId,
        status: "paid",
        planId: "monthly",
        startsAt: rewardEnd,
        expiresAt: paidEnd,
        referralCodeUsed: "LEGACY",
        referredBy: rewardOnlyUserId,
        metadata: { entitlementBefore: {
          planId: "semester",
          startedAt: rewardStart,
          expiresAt: rewardEnd,
          lastPurchase: paidRewardId,
        } },
      },
    ]);
    await purchases.createIndex({ referredBy: 1 }, { name: "referredBy_1" });
    await subscriptions.insertMany([
      { user: rewardOnlyUserId, isActive: true },
      { user: paidUserId, isActive: true },
    ]);
    await codes.insertOne({ owner: rewardOnlyUserId, code: "LEGACY" });
    await redemptions.insertOne({ referrer: rewardOnlyUserId, referredUser: paidUserId });

    const preview = await runReferralRemovalMigration({ connection, now, log: () => {} });
    assert.equal(preview.applied, false);
    assert.equal(preview.rewardPurchases, 2);
    assert.equal(preview.projectedFreeUsers, 1);
    assert.equal(preview.projectedRetainedUsers, 1);
    assert.equal(await purchases.countDocuments({ status: "free_referral" }), 2);

    const applied = await runReferralRemovalMigration({
      connection,
      apply: true,
      acknowledged: true,
      now,
      log: () => {},
    });
    assert.equal(applied.applied, true);
    assert.equal(applied.rewardPurchases, 0);
    assert.equal(await purchases.countDocuments({ status: "free_referral" }), 0);
    assert.equal(await purchases.countDocuments({
      $or: [
        { referralCodeUsed: { $exists: true } },
        { referredBy: { $exists: true } },
      ],
    }), 0);
    assert.equal((await purchases.indexes()).some(({ name }) => name === "referredBy_1"), false);

    const revokedUser = await users.findOne({ _id: rewardOnlyUserId });
    assert.equal(revokedUser.accessRole, "free_user");
    assert.equal(revokedUser.premium.lastPurchase, null);
    assert.equal((await subscriptions.findOne({ user: rewardOnlyUserId })).isActive, false);

    const retainedUser = await users.findOne({ _id: paidUserId });
    const retainedPurchase = await purchases.findOne({ _id: paidPurchaseId });
    assert.equal(retainedUser.accessRole, "monthly_premium_user");
    assert.equal(String(retainedUser.premium.lastPurchase), String(paidPurchaseId));
    assert.equal(retainedPurchase.startsAt.toISOString(), "2026-09-12T00:00:00.000Z");
    assert.equal(retainedPurchase.expiresAt.toISOString(), "2026-10-13T00:00:00.000Z");
    assert.equal((await subscriptions.findOne({ user: paidUserId })).isActive, true);

    const remainingCollections = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = remainingCollections.map(({ name }) => name);
    assert.equal(names.includes("referralcodes"), false);
    assert.equal(names.includes("referralredemptions"), false);

    const rerun = await runReferralRemovalMigration({
      connection,
      apply: true,
      acknowledged: true,
      now,
      log: () => {},
    });
    assert.equal(rerun.applied, true);
    assert.equal(rerun.rewardPurchases, 0);
    assert.equal(rerun.purchasesWithLegacyFields, 0);
  } finally {
    await connection.close();
    await replSet.stop();
  }
});
