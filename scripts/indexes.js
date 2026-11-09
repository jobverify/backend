/**
 * @file Safe index planning and apply utility for all Mongoose models.
 * @module scripts/indexes
 */

import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env"), quiet: true });

const { default: Job } = await import("../src/models/Job.js");
const { default: JobAlertOutbox } = await import('../src/models/JobAlertOutbox.js');
const { default: JobAlertDelivery } = await import('../src/models/JobAlertDelivery.js');
const { default: User } = await import("../src/models/User.js");
const { default: Click } = await import("../src/models/Click.js");
const { default: Subscription } = await import("../src/models/Subscription.js");
const { default: AdminAudit } = await import("../src/models/AdminAudit.js");
const { default: AccessEvent } = await import("../src/models/AccessEvent.js");
const { default: BlacklistedToken } = await import("../src/models/BlacklistedToken.js");
const { default: JobDatasetSummary } = await import("../src/models/JobDatasetSummary.js");
const { default: ScraperRun } = await import("../src/models/ScraperRun.js");
const { default: UserSuggestion } = await import("../src/models/UserSuggestion.js");
const { default: HiringObservation } = await import('../src/models/HiringObservation.js');
const { default: Application } = await import('../src/models/Application.js');
const { default: ApplicationEvent } = await import('../src/models/ApplicationEvent.js');
const { default: CandidateEvidence } = await import('../src/models/CandidateEvidence.js');
const { default: AutoApplyAttempt } = await import('../src/models/AutoApplyAttempt.js');
const { default: Resume } = await import('../src/models/Resume.js');
const { default: ResumeArtifact } = await import('../src/models/ResumeArtifact.js');
const { default: CVRevision } = await import('../src/models/CVRevision.js');
const { default: TailoredResume } = await import('../src/models/TailoredResume.js');
const { default: ResumeUsage } = await import('../src/models/ResumeUsage.js');
const { default: RateLimitBucket } = await import('../src/models/RateLimitBucket.js');

const MODELS = [
  ["Job", Job],
  ['JobAlertOutbox', JobAlertOutbox],
  ['JobAlertDelivery', JobAlertDelivery],
  ["User", User],
  ["Click", Click],
  ["Subscription", Subscription],
  ["AdminAudit", AdminAudit],
  ["AccessEvent", AccessEvent],
  ["BlacklistedToken", BlacklistedToken],
  ["JobDatasetSummary", JobDatasetSummary],
  ["ScraperRun", ScraperRun],
  ["UserSuggestion", UserSuggestion],
  ['HiringObservation', HiringObservation],
  ['Application', Application],
  ['ApplicationEvent', ApplicationEvent],
  ['CandidateEvidence', CandidateEvidence],
  ['AutoApplyAttempt', AutoApplyAttempt],
  ['Resume', Resume],
  ['ResumeArtifact', ResumeArtifact],
  ['CVRevision', CVRevision],
  ['TailoredResume', TailoredResume],
  ['ResumeUsage', ResumeUsage],
  ['RateLimitBucket', RateLimitBucket],
];

const formatIndex = (idx) => {
  const fields = Object.keys(idx.key)
    .map((key) => `${key}: ${idx.key[key]}`)
    .join(", ");

  const extra = [];
  if (idx.unique) extra.push("unique");
  if (idx.sparse) extra.push("sparse");
  if (idx.partialFilterExpression) {
    extra.push(`partial: ${JSON.stringify(idx.partialFilterExpression)}`);
  }

  const suffix = extra.length > 0 ? ` (${extra.join(", ")})` : "";
  return `  [${idx.name}] { ${fields} }${suffix}`;
};

const isNamespaceMissingError = (error) => (
  error?.codeName === "NamespaceNotFound"
  || /ns does not exist/i.test(String(error?.message ?? ""))
);

const readPlannedSchemaIndexes = (model) => model.schema.indexes().map(([key]) => key);

const ensureSafeApply = ({ applyMode, dryRun }) => {
  if (!applyMode || dryRun) {
    return;
  }

  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
  if (nodeEnv === "production") {
    throw new Error("Refusing to apply indexes while NODE_ENV=production.");
  }

  if (process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS !== "true") {
    throw new Error(
      "Refusing to apply index changes without JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS=true.",
    );
  }
};

async function describeModelIndexes(name, model, { log = console.log } = {}) {
  let diff;
  let existingIndexes;

  try {
    diff = await model.diffIndexes();
  } catch (error) {
    if (!isNamespaceMissingError(error)) {
      throw error;
    }

    diff = {
      toCreate: readPlannedSchemaIndexes(model),
      toDrop: [],
    };
  }

  try {
    existingIndexes = await model.collection.indexes();
  } catch (error) {
    if (!isNamespaceMissingError(error)) {
      throw error;
    }

    existingIndexes = [];
  }

  log(`\n--- Model: ${name} ---`);
  log(`  Pending create candidates: ${JSON.stringify(diff.toCreate ?? [], null, 2)}`);
  log(`  Pending drop candidates: ${JSON.stringify(diff.toDrop ?? [], null, 2)}`);
  if (existingIndexes.length === 0) {
    log("  Collection has not been created yet.");
  }
  existingIndexes.forEach((index) => {
    log(formatIndex(index));
  });

  return diff;
}

async function applyModelIndexes(name, model, diff, { dryRun, log = console.log }) {
  if (dryRun || !Array.isArray(diff?.toCreate) || diff.toCreate.length === 0) {
    return;
  }

  log(`  Creating missing indexes for ${name}...`);
  await model.createIndexes();
}

export async function runIndexManagement({
  mode = String(process.argv[2] || "plan").trim().toLowerCase(),
  dryRun = mode !== "apply" || process.argv.includes("--dry-run"),
  shouldConnect = true,
  shouldDisconnect = true,
  log = console.log,
  errorLog = console.error,
} = {}) {
  const applyMode = mode === "apply";
  let hasDifferences = false;
  const results = [];

  try {
    ensureSafeApply({ applyMode, dryRun });
    if (shouldConnect) {
      const { default: connectDB } = await import("../db/db.js");
      await connectDB();
    }

    log(
      applyMode
        ? dryRun
          ? "\nApply mode requested with --dry-run. No index mutations will be applied."
          : "\nApplying missing schema indexes only. Existing extra indexes will not be dropped."
        : "\nPlanning mode only. No index mutations will be applied.",
    );

    for (const [name, model] of MODELS) {
      const diff = await describeModelIndexes(name, model, { log });
      hasDifferences = hasDifferences || (diff?.toCreate?.length ?? 0) > 0 || (diff?.toDrop?.length ?? 0) > 0;
      await applyModelIndexes(name, model, diff, { dryRun, log });
      results.push({ name, diff });
    }
  } catch (error) {
    hasDifferences = true;
    errorLog("Index management failed:", error);
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
  }

  return {
    hasDifferences,
    results,
  };
}

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

async function main() {
  const { hasDifferences } = await runIndexManagement();

  if (hasDifferences) {
    process.exitCode = 1;
  }
}

if (isDirectRun) {
  main();
}
