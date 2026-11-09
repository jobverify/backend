/**
 * @file Handles database persistence for scraper status and runs.
 * @module scraper/utils/scraperPersistence
 */

import mongoose from "mongoose";
import { DEFAULT_JOB_RETENTION_DAYS } from "../../src/utils/jobLifecycle.js";
import { hasIncompleteScraperAttempt, isCompleteScraperAttempt } from "./inventoryEvidence.js";
import { normalizeScraperTaskResult, summarizeScraperHistory } from "./scraperOutcome.js";
import { summarizeScraperRun } from "./scraperRunSummary.js";

// Lazy-load models to prevent circular dependency issues
let ScraperStatus;
let ScraperRun;
export const PIPELINE_SOURCE = "__pipeline__";
const MONGO_MAP_DOT_ESCAPE = "\uFF0E";
const MONGO_MAP_DOLLAR_ESCAPE = "\uFF04";

const ATTEMPT_DIAGNOSTIC_FIELDS = [
  "rawRecords", "filteredNonIndia", "filteredClosed", "filteredInvalidUrl",
  "filteredEmptyDescription", "filteredNonJob", "zeroJobEvidence", "inventoryEvidence", "detailHealth",
  "inventoryDelegationEvidence", "sourceObservations", "retryPressure", "retry", "jobIdentityHashes",
  "attemptedAt", "completedAt", "staleCheckSkipped", "staleCheckReason", "staleCheckReasonCode",
  "softFailure", "upstreamOutage", "failureKind", "partial", "skipped", "processingComplete",
];

const attemptDiagnostics = (result) => Object.fromEntries(
  ATTEMPT_DIAGNOSTIC_FIELDS.map((field) => [field, result[field] ?? null]),
);

const hasIncompleteDetails = (result) => result.detailHealth?.complete === false
  || result.filteredEmptyDescription > 0;

const completeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

const PIPELINE_STATUS_DEFAULTS = {
  lastJobsFound: 0,
  lastEligibleJobsFound: 0,
  lastCompleteJobsFound: null,
  lastCompleteEligibleJobsFound: null,
  lastInserted: 0,
  lastUpdated: 0,
  lastDeleted: 0,
  lastFilteredOld: 0,
  lastExpired: 0,
  lastMissed: 0,
  lastPartialAt: null,
  lastPartialReason: null,
  lastRetentionDays: DEFAULT_JOB_RETENTION_DAYS,
};

export const encodeScraperRunSourceKey = (value) => String(value ?? "")
  .replaceAll("$", MONGO_MAP_DOLLAR_ESCAPE)
  .replaceAll(".", MONGO_MAP_DOT_ESCAPE);

export const decodeScraperRunSourceKey = (value) => String(value ?? "")
  .replaceAll(MONGO_MAP_DOLLAR_ESCAPE, "$")
  .replaceAll(MONGO_MAP_DOT_ESCAPE, ".");

const decodeScraperRunSources = (sources) => {
  if (!sources) return sources;

  const entries = sources instanceof Map
    ? [...sources.entries()]
    : Object.entries(sources);

  return Object.fromEntries(
    entries.map(([sourceKey, sourceSummary]) => [
      decodeScraperRunSourceKey(sourceKey),
      sourceSummary,
    ]),
  );
};

// Lazy-loads the ScraperStatus mongoose model.
const getScraperStatusModel = async () => {
  if (!ScraperStatus) {
    const { default: model } = await import("../../src/models/ScraperStatus.js");
    ScraperStatus = model;
  }
  return ScraperStatus;
};

// Lazy-loads the ScraperRun mongoose model.
const getScraperRunModel = async () => {
  if (!ScraperRun) {
    const { default: model } = await import("../../src/models/ScraperRun.js");
    ScraperRun = model;
  }
  return ScraperRun;
};

// Ensures the mongoose database connection is active.
const ensureConnected = async () => {
  if (mongoose.connection.readyState === 0) {
    const { default: connectDB } = await import("../../db/db.js");
    await connectDB();
  }
};

// Upserts the live ScraperStatus document for a single scraper source.
export const upsertScraperStatus = async (source, result) => {
  await ensureConnected();
  const ScraperStatusModel = await getScraperStatusModel();

  const now = new Date();
  const completeCheck = isCompleteScraperAttempt(result, { now });

  const update = result.success
    ? (() => {
        const jobsFound = result.jobs || 0;
        const eligibleJobsFound = result.eligibleJobs ?? jobsFound;
        const isPartial = hasIncompleteScraperAttempt(result)
          || (result.inventoryEvidence != null && !completeCheck);
        const set = {
          lastRanAt: now,
          lastSuccess: true,
          consecutiveFailures: 0,
          lastError: isPartial ? result.error || null : null,
          softFailure: result.softFailure === true,
          upstreamOutage: result.upstreamOutage === true,
          failureKind: result.failureKind || null,
          durationMs: result.durationMs || 0,
          lastPartialAt: isPartial ? now : null,
          lastPartialReason: isPartial
            ? (result.staleCheckReason || (hasIncompleteDetails(result)
              ? "Employer role details remain incomplete; previous complete-check counts were preserved."
              : "Latest attempt did not establish a complete first-party check; previous complete-check counts were preserved."))
            : null,
          lastRetentionDays: result.retentionDays || DEFAULT_JOB_RETENTION_DAYS,
        };

        if (!isPartial) {
          set.lastJobsFound = jobsFound;
          set.lastEligibleJobsFound = eligibleJobsFound;
          set.lastInserted = result.inserted || 0;
          set.lastUpdated = result.updated || 0;
          set.lastDeleted = result.deleted || 0;
          set.lastFilteredOld = result.filteredOld || 0;
          set.lastExpired = result.expired || 0;
          set.lastMissed = result.missed || 0;
        }

        if (completeCheck) {
          set.lastCompleteJobsFound = completeCount(result.jobs);
          set.lastCompleteEligibleJobsFound = completeCount(result.eligibleJobs);
        }

        return { $set: set };
      })()
    : result.softFailure === true
      ? {
          $set: {
            lastRanAt: now,
            lastSuccess: true,
            consecutiveFailures: 0,
            lastError: result.error || "Unknown upstream scraper condition",
            softFailure: true,
            upstreamOutage: result.upstreamOutage === true,
            failureKind: result.failureKind || "soft_failure",
            durationMs: result.durationMs || 0,
          },
        }
    : {
        $set: {
          lastRanAt: now,
          lastSuccess: false,
          lastError: result.error || "Unknown error",
          softFailure: false,
          upstreamOutage: false,
          failureKind: result.failureKind || "hard_failure",
          durationMs: result.durationMs || 0,
        },
        $inc: {
          consecutiveFailures: 1,
        },
      };

  update.$set.latestAttempt = {
    ...result,
    recordedAt: now,
    jobs: result.jobs ?? null,
    eligibleJobs: result.eligibleJobs ?? null,
    inserted: result.inserted ?? null,
    updated: result.updated ?? null,
    deleted: result.deleted ?? null,
    filteredOld: completeCount(result.filteredOld),
    expired: result.expired ?? null,
    missed: result.missed ?? null,
    ...attemptDiagnostics(result),
  };
  if (completeCheck) {
    update.$set.lastCompleteCheckAt = new Date(result.completedAt || result.inventoryEvidence.verifiedAt);
  }

  await ScraperStatusModel.findOneAndUpdate({ source }, update, {
    upsert: true,
    new: true,
  });
};

// Inserts a single ScraperRun history audit document for the entire pipeline run.
export const writeScraperRun = async (ranAt, summary) => {
  await ensureConnected();
  const ScraperRunModel = await getScraperRunModel();

  const sourcesMap = {};
  for (const [sourceName, rawSourceSummary] of Object.entries(summary)) {
    const sourceSummary = normalizeScraperTaskResult(rawSourceSummary);
    sourcesMap[encodeScraperRunSourceKey(sourceName)] = {
      ...attemptDiagnostics(sourceSummary),
      success: sourceSummary.success,
      jobsFound: sourceSummary.jobs ?? null,
      eligibleJobsFound: sourceSummary.eligibleJobs ?? null,
      inserted: sourceSummary.inserted || 0,
      updated: sourceSummary.updated || 0,
      deleted: sourceSummary.deleted || 0,
      filteredOld: completeCount(sourceSummary.filteredOld),
      missed: sourceSummary.missed || 0,
      expired: sourceSummary.expired || 0,
      staleCheckSkipped: sourceSummary.staleCheckSkipped === true,
      staleCheckReason: sourceSummary.staleCheckReason || null,
      retentionDays: sourceSummary.retentionDays || DEFAULT_JOB_RETENTION_DAYS,
      durationMs: sourceSummary.durationMs || 0,
      error: sourceSummary.error || null,
    };

  }

  await ScraperRunModel.create({
    ranAt,
    sources: sourcesMap,
    overall: {
      ...summarizeScraperRun(Object.values(sourcesMap).map(row => ({ ...row, jobs: row.jobsFound }))),
      ...summarizeScraperHistory(Object.values(sourcesMap)),
    },
  });
};

export const readPreviousScraperRun = async (before = new Date()) => {
  await ensureConnected();
  const ScraperRunModel = await getScraperRunModel();
  const previousRun = await ScraperRunModel.findOne({ ranAt: { $lt: before } })
    .sort({ ranAt: -1 })
    .lean()
    .exec();

  if (!previousRun) return previousRun;

  return {
    ...previousRun,
    sources: decodeScraperRunSources(previousRun.sources),
  };
};

// Marks the shared pipeline status document as actively running.
export const markPipelineRunStarted = async (triggeredAt = new Date()) => {
  await ensureConnected();
  const ScraperStatusModel = await getScraperStatusModel();
  const startedAt = triggeredAt instanceof Date ? triggeredAt : new Date(triggeredAt);

  await ScraperStatusModel.findOneAndUpdate(
    { source: PIPELINE_SOURCE },
    {
      $set: {
        companyName: "Scraper Pipeline",
        url: null,
        isActive: true,
        lastRanAt: startedAt,
        lastSuccess: true,
        consecutiveFailures: 0,
        lastError: null,
        durationMs: 0,
        pipelineState: "running",
        lastTriggeredAt: startedAt,
      },
      $setOnInsert: PIPELINE_STATUS_DEFAULTS,
    },
    {
      upsert: true,
      new: true,
    },
  );
};

// Marks the shared pipeline status document as completed or failed.
export const markPipelineRunFinished = async ({
  startedAt = null,
  completedAt = new Date(),
  aborted = false,
  error = null,
} = {}) => {
  await ensureConnected();
  const ScraperStatusModel = await getScraperStatusModel();
  const finishedAt = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const triggerTime = startedAt instanceof Date
    ? startedAt
    : (startedAt ? new Date(startedAt) : null);

  const durationMs = triggerTime ? Math.max(0, finishedAt.getTime() - triggerTime.getTime()) : 0;

  await ScraperStatusModel.findOneAndUpdate(
    { source: PIPELINE_SOURCE },
    {
      $set: {
        companyName: "Scraper Pipeline",
        url: null,
        isActive: true,
        lastRanAt: finishedAt,
        lastSuccess: !aborted,
        lastError: aborted ? (error || "Pipeline aborted due to repeated scraper failures.") : null,
        consecutiveFailures: aborted ? 1 : 0,
        durationMs,
        pipelineState: aborted ? "error" : "idle",
        lastCompletedAt: finishedAt,
        ...(triggerTime ? { lastTriggeredAt: triggerTime } : {}),
      },
      $setOnInsert: PIPELINE_STATUS_DEFAULTS,
    },
    {
      upsert: true,
      new: true,
    },
  );
};

// Ensures the predefined crawlers are seeded in the database with defaults.
export const ensureScrapersSeeded = async () => {
  await ensureConnected();
  const ScraperStatusModel = await getScraperStatusModel();
  const { getScraperCatalog } = await import("../providers/index.js");

  const activeScrapers = [
    ...new Map(
      getScraperCatalog().map((provider) => [
        provider.source,
        {
          source: provider.source,
          companyName: provider.companyName,
          url: provider.companyCareerPage,
        },
      ]),
    ).values(),
  ];

  if (activeScrapers.length === 0) return;

  const defaultRunTimestamp = new Date(0);
  const operations = activeScrapers.map((item) => ({
    updateOne: {
      filter: { source: item.source },
      update: {
        $set: {
          companyName: item.companyName,
          url: item.url,
        },
        $setOnInsert: {
          isActive: true,
          lastRanAt: defaultRunTimestamp,
          lastSuccess: true,
          consecutiveFailures: 0,
        },
      },
      upsert: true,
    },
  }));

  await ScraperStatusModel.bulkWrite(operations, { ordered: false });
};
