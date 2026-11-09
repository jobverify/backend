import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import User from "../src/models/User.js";
import Job from "../src/models/Job.js";
import Click from "../src/models/Click.js";
import JobDatasetSummary from "../src/models/JobDatasetSummary.js";
import AdminAudit from "../src/models/AdminAudit.js";
import ScraperRun from "../src/models/ScraperRun.js";
import ScraperStatus from "../src/models/ScraperStatus.js";
import Subscription from "../src/models/Subscription.js";
import {
  ACCESS_ROLES,
  PLAN_IDS,
} from "../src/constants/accessPlans.js";
import {
  getUserById,
  getUsersTable,
  getScrapeStatus,
  purgeAllJobs,
  triggerScrapeAdmin,
  updateJobStatus,
  updateUserAccess,
} from "../src/controllers/adminController.js";
import { getScraperCatalog } from "../scraper-support/providers/index.js";
import { getDiskBackedScraperSources } from "../scraper-support/providers/sourceInventory.js";
import { JOB_DATASET_LIFECYCLE_VERSION } from "../src/services/jobDatasetSummaryService.js";
import { applyPublicJobLocationScope } from "../src/utils/publicJobLocationScope.js";
import { PUBLIC_JOB_TYPE_EXPRESSION } from "../src/utils/publicJobType.js";
import { PUBLIC_JOB_TYPES } from "../src/utils/publicJobTypeLabel.js";

const createResponseDouble = () => {
  const result = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return result;
};

const setReadyState = (value) => {
  const hadOwn = Object.prototype.hasOwnProperty.call(mongoose.connection, "readyState");
  const original = hadOwn
    ? Object.getOwnPropertyDescriptor(mongoose.connection, "readyState")
    : null;

  Object.defineProperty(mongoose.connection, "readyState", {
    configurable: true,
    value,
  });

  return () => {
    if (hadOwn && original) {
      Object.defineProperty(mongoose.connection, "readyState", original);
      return;
    }

    delete mongoose.connection.readyState;
  };
};

const applyTopLevelExclusionSelect = (record, selectValue) => {
  const selected = { ...record };
  String(selectValue || "")
    .split(/\s+/u)
    .filter((field) => field.startsWith("-"))
    .forEach((field) => {
      delete selected[field.slice(1)];
    });
  return selected;
};

const getDiskBackedCatalogSources = () => getDiskBackedScraperSources({
  catalog: getScraperCatalog(),
});

// This double models exactly one initial sequential reservation/publication.
// It is not a Mongo evaluator and does not certify concurrent refresh ordering.
const createInitialSummaryWriteDouble = (summaryWrites) => {
  let reservation;
  const query = value => ({ lean: () => ({ exec: async () => value }) });
  return (filter, update, options) => {
    assert.equal(filter.key, "public-active");
    assert.ok(filter._id);
    if (!Array.isArray(update)) {
      assert.equal(reservation, undefined);
      assert.deepEqual(update, { $inc: { refreshSequence: 1 }, $setOnInsert: { key: "public-active" } });
      assert.deepEqual(options, { upsert: true, new: true, setDefaultsOnInsert: true });
      reservation = { _id: filter._id, refreshSequence: 1 };
      return query(reservation);
    }
    assert.ok(reservation);
    assert.equal(summaryWrites.length, 0);
    assert.equal(String(filter._id), String(reservation._id));
    assert.deepEqual(options, { upsert: false, new: true, setDefaultsOnInsert: true });
    assert.equal(update.length, 1);
    const summary = Object.fromEntries(Object.entries(update[0].$set).map(([key, expression]) => {
      assert.equal(expression.$cond.length, 3);
      const [guard, previous, literal] = expression.$cond;
      assert.deepEqual(guard.$and[0], { $eq: ["$lifecycleVersion", JOB_DATASET_LIFECYCLE_VERSION] });
      assert.deepEqual(guard.$and.at(-1), { $gt: ["$publishedSequence", reservation.refreshSequence] });
      assert.equal(previous, "$" + key);
      assert.deepEqual(Object.keys(literal), ["$literal"]);
      return [key, literal.$literal];
    }));
    assert.equal(summary.publishedSequence, reservation.refreshSequence);
    assert.equal(summary.lifecycleVersion, JOB_DATASET_LIFECYCLE_VERSION);
    summaryWrites.push(summary);
    return query({ ...reservation, ...summary });
  };
};

const assertPublicSummaryRefreshPipeline = (pipeline) => {
  const visible = pipeline[1].$facet.visible;
  const lifecycle = visible[0].$match.$expr.$and[0];
  const observedAt = lifecycle.$and[0].$lte[1];
  assert.ok(observedAt instanceof Date && Number.isFinite(+observedAt));
  const { $expr, ...baseScope } = applyPublicJobLocationScope({ status: "active" }, observedAt);
  assert.deepEqual(pipeline[0], { $match: baseScope });
  assert.deepEqual(visible[0], { $match: { $expr: { $and: [$expr, { $in: [PUBLIC_JOB_TYPE_EXPRESSION, PUBLIC_JOB_TYPES] }] } } });
  assert.equal(visible[1].$group.totalJobs.$sum, 1);
  assert.deepEqual(visible[1].$group.jobTypes.$addToSet, PUBLIC_JOB_TYPE_EXPRESSION);
  assert.deepEqual(pipeline[1].$facet.futurePublications[0], { $match: {
    postedAt: { $gt: observedAt },
    $expr: { $or: [
      { $eq: [{ $ifNull: ["$closingDate", null] }, null] },
      { $gt: ["$closingDate", "$postedAt"] },
    ] },
  } });
};

test("updateJobStatus refreshes the public filter summary after hiding a job", async () => {
  const originalFindById = Job.findById;
  const originalAggregate = Job.aggregate;
  const originalAdminAuditCreate = AdminAudit.create;
  const originalSummaryFindOneAndUpdate = JobDatasetSummary.findOneAndUpdate;

  const activeJob = {
    _id: "507f1f77bcf86cd799439011",
    status: "active",
    async save() {
      return this;
    },
  };
  const summaryWrites = [];

  Job.findById = async () => activeJob;
  Job.aggregate = (pipeline) => {
    assertPublicSummaryRefreshPipeline(pipeline);
    return {
      exec: async () => [{ visible: activeJob.status === "active" ? [{
      totalJobs: 1,
      companies: ["Example Labs"],
      cities: ["Pune, India"],
      jobTypes: ["Full-time"],
    }] : [], futurePublications: [] }],
    };
  };
  AdminAudit.create = async () => ({});
  JobDatasetSummary.findOneAndUpdate = createInitialSummaryWriteDouble(summaryWrites);

  try {
    const res = createResponseDouble();

    await updateJobStatus({
      params: { id: "507f1f77bcf86cd799439011" },
      body: { status: "hidden" },
      user: { _id: "admin-1" },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(summaryWrites.length, 1);
    assert.equal(summaryWrites[0].totalJobs, 0);
    assert.equal(summaryWrites[0].totalCompanies, 0);
    assert.deepEqual(summaryWrites[0].companies, []);
    assert.deepEqual(summaryWrites[0].cities, []);
  } finally {
    Job.findById = originalFindById;
    Job.aggregate = originalAggregate;
    AdminAudit.create = originalAdminAuditCreate;
    JobDatasetSummary.findOneAndUpdate = originalSummaryFindOneAndUpdate;
  }
});

test("updateUserAccess lets an admin set a premium plan with a manual expiry override", async () => {
  const originalFindById = User.findById;
  const originalAdminAuditCreate = AdminAudit.create;

  const user = new User({
    email: "managed-user@example.com",
    password: "hashed-password",
  });
  user.save = async function saveDouble() {
    return this;
  };

  const audits = [];

  User.findById = async () => user;
  AdminAudit.create = async (payload) => {
    audits.push(payload);
    return payload;
  };

  try {
    const res = createResponseDouble();

    await updateUserAccess(
      {
        params: { id: "507f1f77bcf86cd799439011" },
        body: {
          accessRole: ACCESS_ROLES.SEMESTER,
          expiresAt: "2026-12-31T00:00:00.000Z",
        },
        user: {
          _id: "admin-1",
          email: "admin@example.com",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(user.accessRole, ACCESS_ROLES.SEMESTER);
    assert.equal(user.premium.planId, PLAN_IDS.SEMESTER);
    assert.equal(user.premium.expiresAt.toISOString(), "2026-12-31T00:00:00.000Z");
    assert.equal(res.body.data.accessRole, ACCESS_ROLES.SEMESTER);
    assert.equal(res.body.data.premium.planId, PLAN_IDS.SEMESTER);
    assert.equal(res.body.data.premium.expiresAt, "2026-12-31T00:00:00.000Z");
    assert.equal(audits.length, 1);
    assert.match(audits[0].details, /Plan role changed/i);
  } finally {
    User.findById = originalFindById;
    AdminAudit.create = originalAdminAuditCreate;
  }
});

test("purgeAllJobs refuses to delete jobs without the exact confirmation phrase", async () => {
  const originalDeleteMany = Job.deleteMany;
  let deleteAttempted = false;

  Job.deleteMany = async () => {
    deleteAttempted = true;
  };

  try {
    const res = createResponseDouble();

    await purgeAllJobs({ body: { confirmation: "purge all jobs" } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /PURGE ALL JOBS/);
    assert.equal(deleteAttempted, false);
  } finally {
    Job.deleteMany = originalDeleteMany;
  }
});

test("purgeAllJobs deletes every job, refreshes the summary, and records the action", async () => {
  const originalDeleteMany = Job.deleteMany;
  const originalAggregate = Job.aggregate;
  const originalAdminAuditCreate = AdminAudit.create;
  const originalSummaryFindOneAndUpdate = JobDatasetSummary.findOneAndUpdate;
  const audits = [];
  const summaryWrites = [];

  Job.deleteMany = async () => ({ deletedCount: 37 });
  Job.aggregate = (pipeline) => {
    assertPublicSummaryRefreshPipeline(pipeline);
    return { exec: async () => [{ visible: [], futurePublications: [] }] };
  };
  AdminAudit.create = async (payload) => {
    audits.push(payload);
    return payload;
  };
  JobDatasetSummary.findOneAndUpdate = createInitialSummaryWriteDouble(summaryWrites);

  try {
    const res = createResponseDouble();

    await purgeAllJobs({
      body: { confirmation: "PURGE ALL JOBS" },
      user: { _id: "admin-1" },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      message: "All job listings were purged",
      data: { deletedCount: 37 },
    });
    assert.equal(summaryWrites.length, 1);
    assert.equal(summaryWrites[0].totalJobs, 0);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "purgeAllJobs");
    assert.match(audits[0].details, /37 job listing/);
  } finally {
    Job.deleteMany = originalDeleteMany;
    Job.aggregate = originalAggregate;
    AdminAudit.create = originalAdminAuditCreate;
    JobDatasetSummary.findOneAndUpdate = originalSummaryFindOneAndUpdate;
  }
});

test("getUsersTable omits password reset internals from admin list payloads", async () => {
  const originalCountDocuments = User.countDocuments;
  const originalFind = User.find;
  const originalSubscriptionFind = Subscription.find;

  const sensitiveUser = {
    _id: "507f1f77bcf86cd799439011",
    email: "managed-user@example.com",
    role: "user",
    accessRole: ACCESS_ROLES.FREE,
    profile: { name: "Managed User" },
    resetPasswordTokenHash: "stored-reset-token-hash",
    resetPasswordExpiresAt: new Date("2026-12-31T00:00:00.000Z"),
    passwordChangedAt: new Date("2026-06-01T00:00:00.000Z"),
    sessionVersion: 4,
    __v: 0,
  };
  let selectValue = "";

  User.countDocuments = async () => 1;
  User.find = () => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    select(value) {
      selectValue = value;
      return this;
    },
    lean() { return this; },
    exec: async () => [applyTopLevelExclusionSelect(sensitiveUser, selectValue)],
  });
  Subscription.find = () => ({
    lean() {
      return { exec: async () => [] };
    },
  });

  try {
    const res = createResponseDouble();

    await getUsersTable({ query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].email, "managed-user@example.com");
    assert.equal(res.body.data[0].resetPasswordTokenHash, undefined);
    assert.equal(res.body.data[0].resetPasswordExpiresAt, undefined);
    assert.equal(res.body.data[0].passwordChangedAt, undefined);
    assert.equal(res.body.data[0].sessionVersion, undefined);
  } finally {
    User.countDocuments = originalCountDocuments;
    User.find = originalFind;
    Subscription.find = originalSubscriptionFind;
  }
});

test("getUserById omits password reset internals from admin detail payloads", async () => {
  const originalFindById = User.findById;
  const originalSubscriptionFindOne = Subscription.findOne;
  const originalClickFind = Click.find;

  const sensitiveUser = {
    _id: "507f1f77bcf86cd799439011",
    email: "managed-user@example.com",
    role: "user",
    accessRole: ACCESS_ROLES.FREE,
    profile: { name: "Managed User" },
    resetPasswordTokenHash: "stored-reset-token-hash",
    resetPasswordExpiresAt: new Date("2026-12-31T00:00:00.000Z"),
    passwordChangedAt: new Date("2026-06-01T00:00:00.000Z"),
    sessionVersion: 4,
    __v: 0,
  };
  let selectValue = "";

  User.findById = () => ({
    select(value) {
      selectValue = value;
      return this;
    },
    lean() { return this; },
    exec: async () => applyTopLevelExclusionSelect(sensitiveUser, selectValue),
  });
  Subscription.findOne = () => ({
    lean() {
      return { exec: async () => null };
    },
  });
  Click.find = () => ({
    sort() { return this; },
    limit() { return this; },
    populate() { return this; },
    lean() { return this; },
    exec: async () => [],
  });

  try {
    const res = createResponseDouble();

    await getUserById(
      { params: { id: "507f1f77bcf86cd799439011" } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.email, "managed-user@example.com");
    assert.equal(res.body.data.resetPasswordTokenHash, undefined);
    assert.equal(res.body.data.resetPasswordExpiresAt, undefined);
    assert.equal(res.body.data.passwordChangedAt, undefined);
    assert.equal(res.body.data.sessionVersion, undefined);
  } finally {
    User.findById = originalFindById;
    Subscription.findOne = originalSubscriptionFindOne;
    Click.find = originalClickFind;
  }
});

test("updateJobStatus hides unexpected persistence failures behind a generic 500", async () => {
  const originalFindById = Job.findById;
  const rawErrorMessage = "database exploded with internal topology details";

  Job.findById = async () => {
    throw new Error(rawErrorMessage);
  };

  try {
    const res = createResponseDouble();

    await updateJobStatus({
      params: { id: "507f1f77bcf86cd799439011" },
      body: { status: "hidden" },
      user: { _id: "admin-1" },
    }, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Internal Server Error");
    assert.equal(JSON.stringify(res.body).includes(rawErrorMessage), false);
  } finally {
    Job.findById = originalFindById;
  }
});

test("getScrapeStatus backfills newly added catalog scrapers before building the admin summary", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const catalogSources = getDiskBackedCatalogSources();
  const allCatalogSources = [...new Set(getScraperCatalog().map((provider) => provider.source))];
  const [firstSource] = catalogSources;
  const recordsBySource = new Map([
    [firstSource, {
      _id: `status-${firstSource}`,
      source: firstSource,
      companyName: "Existing Source",
      url: "https://example.com/existing",
      isActive: true,
      lastRanAt: new Date("2026-07-10T00:00:00.000Z"),
      lastSuccess: true,
      consecutiveFailures: 0,
    }],
  ]);

  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => Array.from(recordsBySource.values()),
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble(null);

  ScraperStatus.bulkWrite = async (operations) => {
    operations.forEach(({ updateOne }) => {
      const source = updateOne.filter.source;
      const existing = recordsBySource.get(source);
      const next = {
        _id: existing?._id || `status-${source}`,
        source,
        ...(existing || {}),
        ...(updateOne.update.$setOnInsert || {}),
        ...(updateOne.update.$set || {}),
      };

      recordsBySource.set(source, next);
    });
  };

  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble(null);
  AdminAudit.findOne = () => createQueryDouble(null);

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sources.length, catalogSources.length);
    assert.equal(recordsBySource.size, allCatalogSources.length);

    const seededSource = res.body.sources.find((source) => source.source !== firstSource);
    assert.ok(seededSource);
    assert.equal(seededSource.isActive, true);
    assert.equal(seededSource.lastSuccess, true);
    assert.equal(seededSource.consecutiveFailures, 0);
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus excludes stale statuses that are not in the scraper catalog", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const [catalogSource] = getDiskBackedCatalogSources();
  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => [
          {
            _id: `status-${catalogSource}`,
            source: catalogSource,
            isActive: true,
            lastRanAt: new Date("2026-07-10T00:00:00.000Z"),
            lastSuccess: true,
            consecutiveFailures: 0,
          },
          {
            _id: "status-F1",
            source: "F1",
            companyName: "F1",
            isActive: true,
            lastRanAt: new Date("2026-07-10T00:00:00.000Z"),
            lastSuccess: false,
            consecutiveFailures: 6,
            lastError: "Simulated failure for F1",
          },
        ],
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble(null);
  ScraperStatus.bulkWrite = async () => {};
  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble(null);
  AdminAudit.findOne = () => createQueryDouble(null);

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sources.some((source) => source.source === "F1"), false);
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus normalizes legacy soft-failure rows before building alerts", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const [catalogSource] = getDiskBackedCatalogSources();
  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => [
          {
            _id: `status-${catalogSource}`,
            source: catalogSource,
            companyName: "Legacy Soft Source",
            isActive: true,
            lastRanAt: new Date("2026-07-10T00:00:00.000Z"),
            lastSuccess: false,
            consecutiveFailures: 3,
            lastError: `[${catalogSource}] All 3 attempts failed. Last error: HTTP 503 for https://example.com/jobs`,
          },
        ],
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble(null);
  ScraperStatus.bulkWrite = async () => {};
  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble(null);
  AdminAudit.findOne = () => createQueryDouble(null);

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.summary.sourcesInAlertState, []);
    const normalizedSource = res.body.sources.find((source) =>
      source.softFailure === true
      && source.upstreamOutage === true
      && source.failureKind === "network_or_timeout");
    assert.ok(normalizedSource);
    assert.equal(normalizedSource.lastSuccess, true);
    assert.equal(normalizedSource.softFailure, true);
    assert.equal(normalizedSource.upstreamOutage, true);
    assert.equal(normalizedSource.failureKind, "network_or_timeout");
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus normalizes remediated legacy implementation failures before returning admin rows", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const catalogSource = getScraperCatalog().find((source) => source.source === "eoxvantage").source;
  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => [
          {
            _id: `status-${catalogSource}`,
            source: catalogSource,
            companyName: "EOX Vantage",
            isActive: true,
            lastRanAt: new Date("2026-07-20T10:00:00.000Z"),
            lastSuccess: false,
            consecutiveFailures: 1,
            lastError: `[${catalogSource}] All 3 attempts failed. Last error: fetchText is not a function`,
          },
        ],
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble(null);
  ScraperStatus.bulkWrite = async () => {};
  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble(null);
  AdminAudit.findOne = () => createQueryDouble(null);

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.summary.sourcesInAlertState, []);
    assert.equal(res.body.sources[0].lastSuccess, true);
    assert.equal(res.body.sources[0].consecutiveFailures, 0);
    assert.equal(res.body.sources[0].softFailure, true);
    assert.equal(res.body.sources[0].failureKind, "remediated_legacy_failure");
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus treats a legacy pipeline error as idle once source failures normalize away", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const catalogSource = getScraperCatalog().find((source) => source.source === "eoxvantage").source;
  const completedAt = new Date("2026-07-20T10:30:00.000Z");
  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => [
          {
            _id: `status-${catalogSource}`,
            source: catalogSource,
            companyName: "EOX Vantage",
            isActive: true,
            lastRanAt: completedAt,
            lastSuccess: false,
            consecutiveFailures: 1,
            lastError: `[${catalogSource}] All 3 attempts failed. Last error: fetchText is not a function`,
          },
        ],
      };
    },
  });
  ScraperStatus.findOne = ({ source }) => createQueryDouble(
    source === "__pipeline__"
      ? {
          source: "__pipeline__",
          pipelineState: "error",
          lastTriggeredAt: new Date("2026-07-20T10:00:00.000Z"),
          lastCompletedAt: completedAt,
          lastError: "Pipeline aborted due to too many scraper errors.",
        }
      : null,
  );
  ScraperStatus.bulkWrite = async () => {};
  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble({ ranAt: completedAt, overall: { totalJobs: 0 } });
  AdminAudit.findOne = () => createQueryDouble(null);

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sources[0].lastSuccess, true);
    assert.equal(res.body.summary.pipeline.status, "idle");
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus prefers the live pipeline status document while a run is active", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  const [activeSource, inactiveSource] = getDiskBackedCatalogSources();
  const sources = [
    {
      _id: `status-${activeSource}`,
      source: activeSource,
      companyName: "Active Source",
      url: `https://example.com/${activeSource}`,
      isActive: true,
      lastRanAt: new Date("2026-07-10T00:00:00.000Z"),
      lastSuccess: true,
      consecutiveFailures: 0,
    },
    {
      _id: `status-${inactiveSource}`,
      source: inactiveSource,
      companyName: "Inactive Source",
      url: `https://example.com/${inactiveSource}`,
      isActive: false,
      lastRanAt: new Date("2026-07-10T00:00:00.000Z"),
      lastSuccess: true,
      consecutiveFailures: 0,
    },
  ];

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => sources,
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble({
    source: "__pipeline__",
    pipelineState: "running",
    lastTriggeredAt: new Date("2026-07-12T05:53:57.867Z"),
    lastCompletedAt: new Date("2026-07-11T21:23:50.154Z"),
  });
  ScraperStatus.bulkWrite = async () => {};

  Job.countDocuments = async () => 42;
  ScraperRun.findOne = () => createQueryDouble({
    overall: {
      totalJobs: 123,
      sourcesSucceeded: 10,
      sourcesFailed: 2,
    },
    ranAt: new Date("2026-07-11T21:23:50.154Z"),
  });
  AdminAudit.findOne = () => createQueryDouble({
    timestamp: new Date("2026-07-11T13:44:20.001Z"),
  });

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sources.length, 2);
    assert.equal(res.body.summary.pipeline.status, "running");
    assert.equal(res.body.summary.pipeline.activeSources, 1);
    assert.equal(
      new Date(res.body.summary.pipeline.lastTriggeredAt).toISOString(),
      "2026-07-12T05:53:57.867Z",
    );
    assert.equal(
      new Date(res.body.summary.pipeline.lastCompletedAt).toISOString(),
      "2026-07-11T21:23:50.154Z",
    );
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus does not report running when completion is newer than the latest trigger", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => [],
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble({
    source: "__pipeline__",
    pipelineState: "running",
    lastTriggeredAt: new Date("2026-07-12T08:20:00.000Z"),
    lastCompletedAt: new Date("2026-07-12T08:21:00.000Z"),
  });
  ScraperStatus.bulkWrite = async () => {};

  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble({
    overall: {
      totalJobs: 1192,
      sourcesSucceeded: 1188,
      sourcesFailed: 4,
    },
    ranAt: new Date("2026-07-12T08:21:00.000Z"),
  });
  AdminAudit.findOne = () => createQueryDouble({
    timestamp: new Date("2026-07-12T08:19:30.000Z"),
  });

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.summary.pipeline.status, "idle");
    assert.equal(
      new Date(res.body.summary.pipeline.lastTriggeredAt).toISOString(),
      "2026-07-12T08:20:00.000Z",
    );
    assert.equal(
      new Date(res.body.summary.pipeline.lastCompletedAt).toISOString(),
      "2026-07-12T08:21:00.000Z",
    );
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("getScrapeStatus treats a newer manual trigger as running even when the last stored pipeline state is error", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFind = ScraperStatus.find;
  const originalFindOne = ScraperStatus.findOne;
  const originalBulkWrite = ScraperStatus.bulkWrite;
  const originalJobCountDocuments = Job.countDocuments;
  const originalScraperRunFindOne = ScraperRun.findOne;
  const originalAdminAuditFindOne = AdminAudit.findOne;

  const createQueryDouble = (value) => ({
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => value,
  });

  ScraperStatus.find = () => ({
    lean() {
      return {
        exec: async () => [],
      };
    },
  });
  ScraperStatus.findOne = () => createQueryDouble({
    source: "__pipeline__",
    pipelineState: "error",
    lastTriggeredAt: new Date("2026-07-12T06:16:58.986Z"),
    lastCompletedAt: new Date("2026-07-12T06:49:32.017Z"),
  });
  ScraperStatus.bulkWrite = async () => {};

  Job.countDocuments = async () => 0;
  ScraperRun.findOne = () => createQueryDouble({
    overall: {
      totalJobs: 1182,
      sourcesSucceeded: 10,
      sourcesFailed: 4,
    },
    ranAt: new Date("2026-07-12T06:49:32.017Z"),
  });
  AdminAudit.findOne = () => createQueryDouble({
    timestamp: new Date("2026-07-12T07:00:00.000Z"),
  });

  try {
    const res = createResponseDouble();

    await getScrapeStatus({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.summary.pipeline.status, "running");
    assert.equal(
      new Date(res.body.summary.pipeline.lastTriggeredAt).toISOString(),
      "2026-07-12T07:00:00.000Z",
    );
  } finally {
    ScraperStatus.find = originalFind;
    ScraperStatus.findOne = originalFindOne;
    ScraperStatus.bulkWrite = originalBulkWrite;
    Job.countDocuments = originalJobCountDocuments;
    ScraperRun.findOne = originalScraperRunFindOne;
    AdminAudit.findOne = originalAdminAuditFindOne;
    restoreReadyState();
  }
});

test("triggerScrapeAdmin marks the pipeline as running immediately after GitHub accepts the dispatch", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFetch = global.fetch;
  const originalAdminAuditCreate = AdminAudit.create;
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate;
  const originalGithubPat = process.env.GITHUB_PAT;
  const originalGithubRepo = process.env.GITHUB_REPO;

  const pipelineWrites = [];
  const auditWrites = [];

  global.fetch = async () => ({
    ok: true,
    status: 204,
    text: async () => "",
  });
  ScraperStatus.findOneAndUpdate = async (filter, update) => {
    pipelineWrites.push({ filter, update });
    return {};
  };
  AdminAudit.create = async (payload) => {
    auditWrites.push(payload);
    return payload;
  };
  process.env.GITHUB_PAT = "test-pat";
  process.env.GITHUB_REPO = "owner/repo";

  try {
    const res = createResponseDouble();

    await triggerScrapeAdmin(
      {
        user: {
          _id: "admin-1",
          email: "admin@example.com",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 202);
    assert.equal(res.body.success, true);
    assert.equal(res.body.auditLogged, true);
    assert.equal(pipelineWrites.length, 1);
    assert.equal(pipelineWrites[0].filter.source, "__pipeline__");
    assert.equal(pipelineWrites[0].update.$set.pipelineState, "running");
    assert.equal(auditWrites.length, 1);
    assert.equal(auditWrites[0].action, "triggerScrapeAdmin");
  } finally {
    restoreReadyState();
    global.fetch = originalFetch;
    AdminAudit.create = originalAdminAuditCreate;
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate;
    process.env.GITHUB_PAT = originalGithubPat;
    process.env.GITHUB_REPO = originalGithubRepo;
  }
});

test("triggerScrapeAdmin reports missing GitHub dispatch configuration", async () => {
  const originalGithubPat = process.env.GITHUB_PAT;
  const originalGithubRepo = process.env.GITHUB_REPO;
  const originalFetch = global.fetch;
  let fetchCalled = false;

  process.env.GITHUB_PAT = "";
  process.env.GITHUB_REPO = "";
  global.fetch = async () => {
    fetchCalled = true;
  };

  try {
    const res = createResponseDouble();

    await triggerScrapeAdmin({ user: { _id: "admin-1" } }, res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
      success: false,
      message: "Scraper pipeline dispatch is not configured. Set GITHUB_PAT and GITHUB_REPO.",
    });
    assert.equal(fetchCalled, false);
  } finally {
    process.env.GITHUB_PAT = originalGithubPat;
    process.env.GITHUB_REPO = originalGithubRepo;
    global.fetch = originalFetch;
  }
});

test("triggerScrapeAdmin still succeeds when the audit log write fails after the dispatch", async () => {
  const restoreReadyState = setReadyState(1);
  const originalFetch = global.fetch;
  const originalAdminAuditCreate = AdminAudit.create;
  const originalFindOneAndUpdate = ScraperStatus.findOneAndUpdate;
  const originalGithubPat = process.env.GITHUB_PAT;
  const originalGithubRepo = process.env.GITHUB_REPO;

  global.fetch = async () => ({
    ok: true,
    status: 204,
    text: async () => "",
  });
  ScraperStatus.findOneAndUpdate = async () => ({});
  AdminAudit.create = async () => {
    throw new Error("Audit write failed");
  };
  process.env.GITHUB_PAT = "test-pat";
  process.env.GITHUB_REPO = "owner/repo";

  try {
    const res = createResponseDouble();

    await triggerScrapeAdmin(
      {
        user: {
          _id: "admin-1",
          email: "admin@example.com",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 202);
    assert.equal(res.body.success, true);
    assert.equal(res.body.auditLogged, false);
    assert.equal(res.body.triggeredBy, "admin@example.com");
  } finally {
    restoreReadyState();
    global.fetch = originalFetch;
    AdminAudit.create = originalAdminAuditCreate;
    ScraperStatus.findOneAndUpdate = originalFindOneAndUpdate;
    process.env.GITHUB_PAT = originalGithubPat;
    process.env.GITHUB_REPO = originalGithubRepo;
  }
});
