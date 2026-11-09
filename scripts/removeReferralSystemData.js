/**
 * Guarded removal of the retired referral system's MongoDB data.
 *
 * Dry run (default): npm run db:remove-referrals
 * Apply: JOBVERIFY_ACKNOWLEDGE_REFERRAL_REMOVAL=true npm run db:remove-referrals -- --apply
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import {
  EntitlementLineageError,
  planEntitlementContributionRemoval,
} from "../src/services/entitlementRemoval.js";

export const LEGACY_REFERRAL = Object.freeze({
  rewardStatus: "free_referral",
  purchaseFields: ["referralCodeUsed", "referredBy"],
  purchaseIndexes: ["referredBy_1"],
  collections: ["referralredemptions", "referralcodes"],
});

const transactionOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
};

export function configureMongooseForReferralRemoval(mongooseInstance = mongoose) {
  mongooseInstance.set("autoIndex", false);
  mongooseInstance.set("autoCreate", false);
}

export function ensureReferralRemovalAcknowledged({ apply, acknowledged }) {
  if (!apply || acknowledged) return;
  throw new Error(
    "Refusing to remove referral data without JOBVERIFY_ACKNOWLEDGE_REFERRAL_REMOVAL=true.",
  );
}

const isMissingNamespace = (error) => error?.code === 26
  || error?.codeName === "NamespaceNotFound";
const isMissingIndex = (error) => error?.code === 27
  || error?.codeName === "IndexNotFound";

const issueCategory = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("missing from the entitlement set")) return "missing_target_purchase";
  if (message.includes("cycle")) return "cyclic_lineage";
  if (message.includes("ambiguous")) return "ambiguous_lineage";
  if (message.includes("unknown plan")) return "unknown_plan";
  return error instanceof EntitlementLineageError
    ? "invalid_lineage"
    : "preflight_error";
};

const collectionExists = async (db, name) => {
  const entries = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return entries.length > 0;
};

export function createMongoReferralRemovalStore(connection, session = null) {
  const db = connection.db;
  if (!db) throw new Error("MongoDB connection is not ready.");
  const purchases = db.collection("planpurchases");
  const users = db.collection("users");
  const subscriptions = db.collection("subscriptions");
  const operationOptions = session ? { session } : {};

  return {
    databaseName: db.databaseName,

    async readInventory() {
      const rewards = await purchases.find(
        { status: LEGACY_REFERRAL.rewardStatus },
        operationOptions,
      ).toArray();
      const purchasesWithLegacyFields = await purchases.countDocuments({
        $or: LEGACY_REFERRAL.purchaseFields.map((field) => ({ [field]: { $exists: true } })),
      }, operationOptions);
      const legacyPurchaseIndexes = await collectionExists(db, "planpurchases")
        ? (await purchases.indexes())
          .map(({ name }) => name)
          .filter((name) => LEGACY_REFERRAL.purchaseIndexes.includes(name))
        : [];
      const collectionCounts = {};
      for (const name of LEGACY_REFERRAL.collections) {
        collectionCounts[name] = await collectionExists(db, name)
          ? await db.collection(name).countDocuments({}, operationOptions)
          : 0;
      }
      return {
        rewards,
        purchasesWithLegacyFields,
        legacyPurchaseIndexes,
        collectionCounts,
      };
    },

    async readEntitlement(userId) {
      const user = await users.findOne({ _id: userId }, operationOptions);
      const lineage = await purchases.find({
        user: userId,
        status: { $in: ["paid", "refunded", LEGACY_REFERRAL.rewardStatus] },
      }, operationOptions).toArray();
      return { user, purchases: lineage };
    },

    async withTransaction(work) {
      return connection.transaction(
        async (transactionSession) => work(
          createMongoReferralRemovalStore(connection, transactionSession),
        ),
        transactionOptions,
      );
    },

    async applyEntitlementRemoval({ reward, removal }) {
      for (const patch of removal.purchasePatches) {
        await purchases.updateOne(
          { _id: patch.id },
          { $set: {
            startsAt: patch.startsAt,
            expiresAt: patch.expiresAt,
            metadata: patch.metadata,
          } },
          operationOptions,
        );
      }
      if (removal.userPatch) {
        await users.updateOne(
          { _id: reward.user },
          { $set: removal.userPatch },
          operationOptions,
        );
      }
      if (removal.deactivateSubscription) {
        await subscriptions.updateMany(
          { user: reward.user },
          { $set: { isActive: false } },
          operationOptions,
        );
      }
      await purchases.deleteOne({ _id: reward._id }, operationOptions);
    },

    async unsetLegacyPurchaseFields() {
      await purchases.updateMany(
        { $or: LEGACY_REFERRAL.purchaseFields.map((field) => ({ [field]: { $exists: true } })) },
        { $unset: Object.fromEntries(LEGACY_REFERRAL.purchaseFields.map((field) => [field, ""])) },
        operationOptions,
      );
    },

    async dropLegacyPurchaseIndexes() {
      for (const name of LEGACY_REFERRAL.purchaseIndexes) {
        try {
          await purchases.dropIndex(name);
        } catch (error) {
          if (!isMissingIndex(error) && !isMissingNamespace(error)) throw error;
        }
      }
    },

    async dropCollection(name) {
      try {
        await db.dropCollection(name);
      } catch (error) {
        if (!isMissingNamespace(error)) throw error;
      }
    },
  };
}

const planRemoval = async ({ store, reward, now }) => {
  const { user, purchases } = await store.readEntitlement(reward.user);
  if (!user) {
    return {
      issue: {
        userId: String(reward.user),
        purchaseId: String(reward._id),
        category: "missing_user",
      },
    };
  }

  try {
    return {
      removal: planEntitlementContributionRemoval({
        user,
        purchases,
        targetPurchaseId: reward._id,
        now,
        contributingStatuses: ["paid", LEGACY_REFERRAL.rewardStatus],
        lineageStatuses: ["paid", "refunded", LEGACY_REFERRAL.rewardStatus],
      }),
    };
  } catch (error) {
    return {
      issue: {
        userId: String(reward.user),
        purchaseId: String(reward._id),
        category: issueCategory(error),
      },
    };
  }
};

const buildReport = ({ store, inventory, planned, issues, applied }) => {
  const affectedUsers = new Set(inventory.rewards.map((reward) => String(reward.user))).size;
  return {
    database: store.databaseName,
    rewardPurchases: inventory.rewards.length,
    affectedUsers,
    purchasesWithLegacyFields: inventory.purchasesWithLegacyFields,
    legacyPurchaseIndexes: inventory.legacyPurchaseIndexes ?? [],
    projectedFreeUsers: planned.filter(({ removal }) => removal.outcome === "free").length,
    projectedRetainedUsers: planned.filter(({ removal }) => removal.outcome !== "free").length,
    referralCodeDocuments: inventory.collectionCounts.referralcodes ?? 0,
    referralRedemptionDocuments: inventory.collectionCounts.referralredemptions ?? 0,
    issues,
    applied,
  };
};

export async function runReferralRemovalMigration({
  connection,
  store,
  apply = false,
  acknowledged = false,
  now = new Date(),
  log = console.log,
} = {}) {
  ensureReferralRemovalAcknowledged({ apply, acknowledged });
  const migrationStore = store ?? createMongoReferralRemovalStore(connection);
  const inventory = await migrationStore.readInventory();
  const planned = [];
  const issues = [];

  for (const reward of inventory.rewards) {
    const result = await planRemoval({ store: migrationStore, reward, now });
    if (result.issue) issues.push(result.issue);
    else planned.push({ reward, removal: result.removal });
  }

  const preview = buildReport({
    store: migrationStore,
    inventory,
    planned,
    issues,
    applied: false,
  });
  log(JSON.stringify(preview));
  if (!apply) return preview;
  if (issues.length > 0) {
    throw new Error(`Referral removal preflight failed with ${issues.length} issue(s).`);
  }

  for (const { reward } of planned) {
    await migrationStore.withTransaction(async (transactionStore) => {
      const current = await planRemoval({ store: transactionStore, reward, now });
      if (current.issue) {
        throw new Error(`Referral removal preflight changed for purchase ${String(reward._id)}.`);
      }
      await transactionStore.applyEntitlementRemoval({
        reward,
        removal: current.removal,
      });
    });
  }

  await migrationStore.unsetLegacyPurchaseFields();
  await migrationStore.dropLegacyPurchaseIndexes();
  for (const name of LEGACY_REFERRAL.collections) {
    await migrationStore.dropCollection(name);
  }

  const finalInventory = await migrationStore.readInventory();
  const result = buildReport({
    store: migrationStore,
    inventory: finalInventory,
    planned: [],
    issues: [],
    applied: true,
  });
  log(JSON.stringify(result));
  return result;
}

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

async function main() {
  const apply = process.argv.includes("--apply");
  const acknowledged = process.env.JOBVERIFY_ACKNOWLEDGE_REFERRAL_REMOVAL === "true";
  ensureReferralRemovalAcknowledged({ apply, acknowledged });
  configureMongooseForReferralRemoval();

  try {
    const { default: connectDB } = await import("../db/db.js");
    await connectDB();
    const result = await runReferralRemovalMigration({
      connection: mongoose.connection,
      apply,
      acknowledged,
      log: () => {},
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

if (isDirectRun) {
  main().catch((error) => {
    console.error(`Referral removal migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
