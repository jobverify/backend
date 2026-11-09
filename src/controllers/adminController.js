/**
 * @file Controllers for admin dashboard metrics, user/job management, and scraper controls.
 * @module controllers/adminController
 */

import mongoose from "mongoose";
import User from "../models/User.js";
import Job from "../models/Job.js";
import Click from "../models/Click.js";
import Subscription from "../models/Subscription.js";
import AdminAudit from "../models/AdminAudit.js";
import ScraperRun from "../models/ScraperRun.js";
import ScraperStatus from "../models/ScraperStatus.js";
import { ACCESS_ROLES } from "../constants/accessPlans.js";
import { buildAdminManagedAccessState } from "../utils/adminPlanAccess.js";
import {
  ensureScrapersSeeded,
  markPipelineRunStarted,
  PIPELINE_SOURCE,
} from "../../scraper-support/utils/scraperPersistence.js";
import { getScraperCatalog } from "../../scraper-support/providers/index.js";
import { getDiskBackedScraperSources } from "../../scraper-support/providers/sourceInventory.js";
import { classifyScraperError } from "../../scraper-support/utils/failureClassification.js";
import { refreshJobDatasetSummary } from "../services/jobDatasetSummaryService.js";
import { respondWithInternalError } from "../utils/respondWithInternalError.js";
import { removeUserAccount } from "../services/userAccountDeletion.js";

const MAX_REGEX_FILTER_LENGTH = 80;
const MAX_PAGE = 500;
const ADMIN_ROLES = ["user", "admin"];
const JOB_STATUSES = ["active", "expired", "hidden"];
const JOB_PURGE_CONFIRMATION = "PURGE ALL JOBS";
const MANAGED_ACCESS_ROLES = Object.values(ACCESS_ROLES);
const SCRAPER_STATUS_SEED_WINDOW_MS = 5 * 60 * 1000;
const ADMIN_USER_PRIVATE_FIELD_EXCLUSIONS = [
  "-password",
  "-resetPasswordTokenHash",
  "-resetPasswordExpiresAt",
  "-passwordChangedAt",
  "-sessionVersion",
  "-__v",
].join(" ");
const REMEDIATED_LEGACY_FAILURE_SIGNATURES = new Map([
  ["accelyasolutionsindialimited", [/HTTP 400 .*accelya\.wd103\.myworkdayjobs\.com/i]],
  ["eoxvantage", [/fetchText is not a function/i]],
  ["fingent", [/fetchText is not a function/i]],
  ["graygraphtechnologiesprivatelimited", [/fetchText is not a function/i]],
  ["guidewire", [/HTTP 400 .*wd5\.myworkdaysite\.com\/wday\/cxs\/guidewire\/external\/jobs/i]],
  ["hashcashconsultants", [/fetchText is not a function/i]],
  ["kochbusinesssolutions", [/fetchText is not a function/i]],
  ["logelite", [/fetchText is not a function/i]],
  ["ncrvoyix", [/Waiting for selector `ul\[role="list"\]` failed/i]],
  ["pena4techsolutions", [/fetchText is not a function/i]],
  ["selectsys", [/fetchText is not a function/i]],
  ["shipsy", [/Cannot read properties of null \(reading 'detailUrl'\)/i]],
  ["signitysolutions", [/fetchText is not a function/i]],
  ["softprodigysystemsolutions", [/fetchText is not a function/i]],
  ["target", [/HTTP 400 .*target\.wd5\.myworkdayjobs\.com\/wday\/cxs\/target\/targetcareers\/jobs/i]],
  ["waydotcomindia", [/Waiting for selector `\.job-card \.outline-btn-grn` failed/i]],
]);

let lastScraperStatusSeedAt = 0;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeFilterText = (value) => String(value || "").trim().slice(0, MAX_REGEX_FILTER_LENGTH);

const buildSafeRegex = (value) => {
  const normalized = normalizeFilterText(value);
  return normalized ? new RegExp(escapeRegex(normalized), "i") : null;
};

const derivePipelineState = ({
  persistedState = null,
  fallbackPipelineIsRunning = false,
  hasRecordedCompletion = false,
  hasActiveSourceFailure = true,
}) => {
  if (fallbackPipelineIsRunning) return "running";
  if (persistedState === "running") return hasRecordedCompletion ? "idle" : "running";
  if (persistedState === "error") {
    return hasRecordedCompletion && !hasActiveSourceFailure ? "idle" : "error";
  }
  return "idle";
};

const getMostRecentTimestamp = (...values) => {
  const validDates = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (validDates.length === 0) return null;

  return new Date(Math.max(...validDates.map((value) => value.getTime())));
};

const isRemediatedLegacyScraperFailure = (status) => {
  const source = String(status.source || "").toLowerCase();
  const signatures = REMEDIATED_LEGACY_FAILURE_SIGNATURES.get(source);
  if (!signatures) return false;

  const lastError = String(status.lastError || "");
  return signatures.some((signature) => signature.test(lastError));
};

const normalizeScraperStatusForAdmin = (status) => {
  if (status.lastSuccess !== false || !status.lastError) return status;
  const remediatedLegacyFailure = isRemediatedLegacyScraperFailure(status);

  const classification = classifyScraperError({
    message: status.lastError,
    softFailure: status.softFailure,
    upstreamOutage: status.upstreamOutage,
    failureKind: status.failureKind,
  });

  if (!classification.softFailure && !remediatedLegacyFailure) return status;

  return {
    ...status,
    lastSuccess: true,
    consecutiveFailures: 0,
    softFailure: true,
    upstreamOutage: remediatedLegacyFailure ? false : classification.upstreamOutage,
    failureKind: remediatedLegacyFailure
      ? "remediated_legacy_failure"
      : classification.failureKind,
  };
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const isSameUser = (requestUser, targetUser) => String(requestUser?._id) === String(targetUser?._id);
const respondWithAdminInternalError = (res, error) => (
  respondWithInternalError(res, error, {
    logLabel: "[adminController] Request failed:",
  })
);

const ensureFreshScraperStatusCatalog = async () => {
  const now = Date.now();
  if (now - lastScraperStatusSeedAt < SCRAPER_STATUS_SEED_WINDOW_MS) return;

  await ensureScrapersSeeded();
  lastScraperStatusSeedAt = now;
};

// Returns aggregated metrics for the administration dashboard overview.
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      verifiedUsers,
      activeJobs,
      hiddenJobs,
      expiredJobs,
      activeSubscriptions,
      totalClicksAllTime,
      totalClicksToday,
      totalClicksThisWeek,
      jobsAddedToday,
      usersJoinedToday,
      recentUsers,
      jobsAddedSeries,
      activeScrapers,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isVerified: true }),
      Job.countDocuments({ status: "active" }),
      Job.countDocuments({ status: "hidden" }),
      Job.countDocuments({ status: "expired" }),
      Subscription.countDocuments({ isActive: true }),
      Click.countDocuments({}),
      Click.countDocuments({ clickedAt: { $gte: startOfToday } }),
      Click.countDocuments({ clickedAt: { $gte: sevenDaysAgo } }),
      Job.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("email profile.name createdAt")
        .lean()
        .exec(),
      Job.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              source: "$source",
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.date": 1 },
        },
      ]),
      ScraperStatus.find({ source: { $ne: PIPELINE_SOURCE } }).select("source").lean().exec(),
    ]);
    const uniqueSources = [...new Set([
      ...activeScrapers.map((s) => s.source),
      ...jobsAddedSeries.map((item) => item._id.source).filter(Boolean),
    ])];

    const dailySeries = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const dayData = { date: dateStr };
      uniqueSources.forEach((source) => {
        dayData[source] = 0;
      });

      jobsAddedSeries.forEach((item) => {
        if (item._id.date === dateStr) {
          const source = item._id.source || "unknown";
          dayData[source] = item.count;
        }
      });

      dailySeries.push(dayData);
    }

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, verified: verifiedUsers, joinedToday: usersJoinedToday, recent: recentUsers },
        jobs: { active: activeJobs, hidden: hiddenJobs, expired: expiredJobs, addedToday: jobsAddedToday, chartData: dailySeries },
        clicks: { allTime: totalClicksAllTime, today: totalClicksToday, thisWeek: totalClicksThisWeek },
        subscriptions: { active: activeSubscriptions },
      },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns daily click aggregation counts for the past N days.
export const getClickTimeSeries = async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 30));
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await Click.aggregate([
      {
        $match: {
          clickedAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$clickedAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const found = stats.find((s) => s._id === dateStr);
      result.push({
        date: dateStr,
        count: found ? found.count : 0,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns the top 10 job listings by click popularity.
export const getTopJobs = async (req, res) => {
  try {
    const topJobs = await Job.find({})
      .sort({ clickCount: -1, postedAt: -1 })
      .limit(10)
      .select("title company city clickCount status")
      .lean()
      .exec();

    res.status(200).json({ success: true, data: topJobs });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns click counts grouped by job listing cities.
export const getClicksByLocation = async (req, res) => {
  try {
    const stats = await Click.aggregate([
      {
        $lookup: {
          from: "jobs",
          localField: "job",
          foreignField: "_id",
          as: "jobDetails",
        },
      },
      {
        $unwind: "$jobDetails",
      },
      {
        $group: {
          _id: { $ifNull: ["$jobDetails.city", "Unknown"] },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 15,
      },
    ]);

    const formattedStats = stats.map((s) => ({
      city: s._id,
      count: s.count,
    }));

    res.status(200).json({ success: true, data: formattedStats });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns daily new user growth counts for the past N days.
export const getUserGrowthTimeSeries = async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 30));
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const found = stats.find((s) => s._id === dateStr);
      result.push({
        date: dateStr,
        count: found ? found.count : 0,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns a paginated, searchable list of user accounts.
export const getUsersTable = async (req, res) => {
  try {
    const { page, limit, search, role, verified } = req.query;

    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 10;
    const MAX_LIMIT = 50;

    let pageNum = Math.min(MAX_PAGE, Math.max(1, parseInt(page) || DEFAULT_PAGE));
    let limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (role && ADMIN_ROLES.includes(role)) {
      query.role = role;
    }
    if (verified) {
      query.isVerified = verified === "true";
    }
    if (search) {
      const searchRegex = buildSafeRegex(search);
      if (searchRegex) {
        query.$or = [
          { email: searchRegex },
          { "profile.name": searchRegex },
        ];
      }
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select(ADMIN_USER_PRIVATE_FIELD_EXCLUSIONS)
      .lean()
      .exec();

    const userIds = users.map((u) => u._id);
    const subscriptions = await Subscription.find({ user: { $in: userIds } }).lean().exec();

    const data = users.map((user) => {
      const sub = subscriptions.find((s) => s.user.toString() === user._id.toString());
      return {
        ...user,
        id: user._id,
        subscription: sub ? { isActive: sub.isActive, frequency: sub.frequency } : null,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data,
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns detailed profile, subscriptions, and click history for a user.
export const getUserById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id)
      .select(ADMIN_USER_PRIVATE_FIELD_EXCLUSIONS)
      .lean()
      .exec();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const subscription = await Subscription.findOne({ user: user._id }).lean().exec();
    const clicks = await Click.find({ user: user._id })
      .sort({ clickedAt: -1 })
      .limit(100)
      .populate("job", "title company city")
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      data: {
        ...user,
        id: user._id,
        subscription: subscription ? { isActive: subscription.isActive, frequency: subscription.frequency } : null,
        clicks,
      },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Updates a user role and creates an administrative audit trail.
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role specified" });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (isSameUser(req.user, user)) {
      return res.status(400).json({ success: false, message: "You cannot change your own role" });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AdminAudit.create({
      admin: req.user._id,
      action: "updateUserRole",
      targetType: "User",
      targetId: user._id,
      details: `Role changed from ${oldRole} to ${role}`,
    });

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: { id: user._id, role: user.role },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Updates the administrator-managed Telegram permission independently of opt-in.
export const updateUserTelegramAccess = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "enabled must be a boolean" });
    }
    // Update only the administrative permission; a concurrent member save of
    // their Telegram preferences cannot overwrite this separate field.
    const user = await User.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { telegramAlertsAllowed: req.body.enabled } },
      { new: true, runValidators: true },
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await AdminAudit.create({
      admin: req.user._id,
      action: "updateUserTelegramAccess",
      targetType: "User",
      targetId: user._id,
      details: `Telegram alerts access ${user.telegramAlertsAllowed ? "enabled" : "disabled"}`,
    });
    return res.status(200).json({
      success: true,
      data: { id: user._id, telegramAlertsAllowed: user.telegramAlertsAllowed },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Updates a user's plan role and premium expiry, with automatic expiry defaults for paid plans.
export const updateUserAccess = async (req, res) => {
  try {
    const { accessRole, expiresAt } = req.body;
    if (!MANAGED_ACCESS_ROLES.includes(accessRole)) {
      return res.status(400).json({ success: false, message: "Invalid plan role specified" });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const oldAccessRole = user.accessRole;
    const oldPlanId = user.premium?.planId ?? null;
    const oldExpiry = user.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
    const nextState = buildAdminManagedAccessState({
      user,
      accessRole,
      expiresAt,
    });

    user.accessRole = nextState.accessRole;
    user.premium.planId = nextState.premium.planId;
    user.premium.status = nextState.premium.status;
    user.premium.startedAt = nextState.premium.startedAt;
    user.premium.expiresAt = nextState.premium.expiresAt;
    user.premium.telegramAlertsEnabled = nextState.premium.telegramAlertsEnabled;
    await user.save();

    await AdminAudit.create({
      admin: req.user._id,
      action: "updateUserAccess",
      targetType: "User",
      targetId: user._id,
      details: `Plan role changed from ${oldAccessRole} (${oldPlanId || "none"}) to ${user.accessRole} (${user.premium?.planId || "none"}) with expiry ${oldExpiry?.toISOString() || "none"} -> ${user.premium?.expiresAt?.toISOString() || "none"}`,
    });

    res.status(200).json({
      success: true,
      message: "User plan access updated successfully",
      data: {
        id: user._id,
        accessRole: user.accessRole,
        premium: {
          planId: user.premium?.planId ?? null,
          status: user.premium?.status ?? null,
          startedAt: user.premium?.startedAt?.toISOString?.() ?? null,
          expiresAt: user.premium?.expiresAt?.toISOString?.() ?? null,
          telegramAlertsEnabled: Boolean(user.premium?.telegramAlertsEnabled),
        },
      },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns a paginated, filterable list of all job listings.
export const getJobsTable = async (req, res) => {
  try {
    const { page, limit, status, company, city, search } = req.query;

    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 10;
    const MAX_LIMIT = 50;

    let pageNum = Math.min(MAX_PAGE, Math.max(1, parseInt(page) || DEFAULT_PAGE));
    let limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (status && JOB_STATUSES.includes(status)) {
      query.status = status;
    }
    if (company) {
      const companyRegex = buildSafeRegex(company);
      if (companyRegex) query.company = companyRegex;
    }
    if (city) {
      const cityRegex = buildSafeRegex(city);
      if (cityRegex) query.city = cityRegex;
    }
    if (search) {
      const searchRegex = buildSafeRegex(search);
      if (searchRegex) {
        query.$or = [
          { title: searchRegex },
          { company: searchRegex },
        ];
      }
    }

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort({ postedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    const data = jobs.map((j) => ({
      ...j,
      id: j._id,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data,
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Updates a job listing status and creates an administrative audit trail.
export const updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!JOB_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status specified" });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const oldStatus = job.status;
    job.status = status;
    await job.save();
    await refreshJobDatasetSummary();

    await AdminAudit.create({
      admin: req.user._id,
      action: "updateJobStatus",
      targetType: "Job",
      targetId: job._id,
      details: `Status changed from ${oldStatus} to ${status}`,
    });

    if (!await Job.findById(job._id, '_id')) {
      await AdminAudit.deleteMany({ targetType: 'Job', targetId: job._id });
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.status(200).json({
      success: true,
      message: "Job status updated successfully",
      data: { id: job._id, status: job.status },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Deletes every job listing after an explicit administrator confirmation.
export const purgeAllJobs = async (req, res) => {
  try {
    if (req.body?.confirmation !== JOB_PURGE_CONFIRMATION) {
      return res.status(400).json({
        success: false,
        message: `Type ${JOB_PURGE_CONFIRMATION} to purge all job listings`,
      });
    }

    const { deletedCount } = await Job.deleteMany({});
    await refreshJobDatasetSummary();
    await AdminAudit.create({
      admin: req.user._id,
      action: "purgeAllJobs",
      targetType: "Job",
      targetId: null,
      details: `Purged ${deletedCount} job listing(s)`,
    });

    return res.status(200).json({
      success: true,
      message: "All job listings were purged",
      data: { deletedCount },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns a paginated audit log of administrative actions.
export const getAuditLog = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 10;
    const MAX_LIMIT = 50;

    let pageNum = Math.min(MAX_PAGE, Math.max(1, parseInt(page) || DEFAULT_PAGE));
    let limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const total = await AdminAudit.countDocuments({});
    const audits = await AdminAudit.find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("admin", "email profile.name")
      .lean()
      .exec();

    const data = audits.map((a) => ({
      ...a,
      id: a._id,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data,
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Returns live status cards and alerts for all crawler sources.
export const getScrapeStatus = async (req, res) => {
  try {
    await ensureFreshScraperStatusCatalog();

    const [
      pipelineStatus,
      sources,
      totalActiveJobs,
      latestCompletedRun,
      latestTriggerAudit,
    ] = await Promise.all([
      ScraperStatus.findOne({ source: PIPELINE_SOURCE }).lean().exec(),
      ScraperStatus.find({ source: { $ne: PIPELINE_SOURCE } }).lean().exec(),
      Job.countDocuments({ status: "active" }),
      ScraperRun.findOne({}).sort({ ranAt: -1 }).lean().exec(),
      AdminAudit.findOne({ action: "triggerScrapeAdmin" }).sort({ timestamp: -1 }).lean().exec(),
    ]);

    const catalogSourceSet = new Set(getDiskBackedScraperSources({
      catalog: getScraperCatalog(),
    }));
    const catalogSources = sources
      .filter((source) => catalogSourceSet.has(source.source))
      .map(normalizeScraperStatusForAdmin);
    const sourcesInAlertState = catalogSources
      .filter((s) => s.consecutiveFailures >= 3 && s.isActive !== false)
      .map((s) => s.source);
    const hasActiveSourceFailure = catalogSources.some(
      (source) => source.isActive !== false && source.lastSuccess === false,
    );

    const latestTriggerAt = getMostRecentTimestamp(
      pipelineStatus?.lastTriggeredAt ?? null,
      latestTriggerAudit?.timestamp ?? null,
    );
    const latestCompletedAt = getMostRecentTimestamp(
      pipelineStatus?.lastCompletedAt ?? null,
      latestCompletedRun?.ranAt ?? null,
    );
    const fallbackPipelineIsRunning = latestTriggerAt
      ? !latestCompletedAt || new Date(latestTriggerAt).getTime() > new Date(latestCompletedAt).getTime()
      : false;
    const pipelineState = derivePipelineState({
      persistedState: pipelineStatus?.pipelineState ?? null,
      fallbackPipelineIsRunning,
      hasRecordedCompletion: Boolean(latestCompletedAt),
      hasActiveSourceFailure,
    });

    const formattedSources = catalogSources.map((s) => ({
      ...s,
      id: s._id,
    }));

    res.status(200).json({
      success: true,
      sources: formattedSources,
      summary: {
        totalActiveJobs,
        sourcesInAlertState,
        pipeline: {
          status: pipelineState,
          activeSources: catalogSources.filter((source) => source.isActive !== false).length,
          lastTriggeredAt: latestTriggerAt,
          lastCompletedAt: latestCompletedAt,
          latestRun: latestCompletedRun
            ? {
                totalJobs: latestCompletedRun.overall?.totalJobs ?? 0,
                sourcesSucceeded: latestCompletedRun.overall?.sourcesSucceeded ?? 0,
                sourcesFailed: latestCompletedRun.overall?.sourcesFailed ?? 0,
              }
            : null,
        },
      },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Triggers the web scraper crawler pipeline via GitHub Actions.
export const triggerScrapeAdmin = async (req, res) => {
  if (!process.env.GITHUB_PAT || !process.env.GITHUB_REPO) {
    return res.status(503).json({
      success: false,
      message: "Scraper pipeline dispatch is not configured. Set GITHUB_PAT and GITHUB_REPO.",
    });
  }

  try {
    const triggeredAt = new Date();

    const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/scraper.yml/dispatches`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${process.env.GITHUB_PAT}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }

    await markPipelineRunStarted(triggeredAt);

    let auditLogged = true;
    try {
      await AdminAudit.create({
        admin: req.user._id,
        action: "triggerScrapeAdmin",
        targetType: "ScraperStatus",
        targetId: null,
        details: `Triggered GitHub Actions scraper workflow for ${process.env.GITHUB_REPO}`,
      });
    } catch (auditError) {
      auditLogged = false;
      console.warn("[adminController] Manual trigger audit log failed:", auditError.message);
    }

    res.status(202).json({
      code: 202,
      success: true,
      message: "Scraper pipeline triggered via GitHub Actions. Check status cards shortly.",
      triggeredAt: triggeredAt.toISOString(),
      triggeredBy: req.user?.email ?? "unknown",
      auditLogged,
    });

    console.log(`[adminController] Manual scraper trigger (GitHub Action) by ${req.user?.email} at ${triggeredAt.toISOString()}`);
  } catch (err) {
    console.error("[adminController] Manual run failed:", err.message);
    // Even if it fails, we send a response if we haven't already.
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to trigger scraper." });
    }
  }
};

// Toggles the active status of a scraper source.
export const toggleScraperActive = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive status must be a boolean" });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid scraper status ID" });
    }

    const scraper = await ScraperStatus.findById(req.params.id);
    if (!scraper) {
      return res.status(404).json({ success: false, message: "Scraper status not found" });
    }

    scraper.isActive = isActive;
    await scraper.save();

    await AdminAudit.create({
      admin: req.user._id,
      action: "toggleScraperActive",
      targetType: "ScraperStatus",
      targetId: scraper._id,
      details: `Scraper ${scraper.source} active state toggled to ${isActive}`,
    });

    res.status(200).json({
      success: true,
      message: `Scraper ${scraper.source} ${isActive ? "activated" : "deactivated"} successfully`,
      data: { id: scraper._id, source: scraper.source, isActive: scraper.isActive },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

// Permanently deletes a member account so the same email can start fresh.
export const deleteUser = async (req, res) => {
  let accessRevoked = false;
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (isSameUser(req.user, user)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account from the admin directory" });
    }
    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "You are not authorized to delete an administrator account" });
    }
    if (!user.email) {
      throw new Error("User email is required for account deletion");
    }

    // Reject new requests throughout cleanup, including retries after a failure.
    const revoked = await User.updateOne(
      { _id: user._id, role: "user" },
      { $set: { deactivated: true }, $inc: { sessionVersion: 1 } },
    );
    if (revoked.matchedCount !== 1) {
      return res.status(409).json({ success: false, message: "The user account changed. Refresh the directory and try again." });
    }
    accessRevoked = true;

    await removeUserAccount(user);
    // Record the action without retaining the deleted member's identity.
    await AdminAudit.create({
      admin: req.user._id,
      action: "deleteUser",
      targetType: "User",
      targetId: null,
      details: "User account and linked records permanently deleted",
    }).catch((error) => console.error("Failed to audit user deletion:", error));

    return res.status(200).json({
      success: true,
      message: "User account deleted successfully. They can sign in again with a fresh account.",
      data: { id: user._id },
    });
  } catch (error) {
    return respondWithInternalError(res, error, {
      message: accessRevoked
        ? "Deletion could not be completed. The account is deactivated. Retry deletion to finish removing its data."
        : "Internal Server Error",
      logLabel: "[adminController] User deletion failed:",
    });
  }
};

// Toggles user deactivation status and creates an administrative audit trail.
export const toggleUserStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (isSameUser(req.user, user)) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
    }
    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "You are not authorized to change this user's status" });
    }

    user.deactivated = !user.deactivated;
    await user.save();

    await AdminAudit.create({
      admin: req.user._id,
      action: "toggleUserStatus",
      targetType: "User",
      targetId: user._id,
      details: `User status changed to ${user.deactivated ? "Deactivated" : "Active"}`,
    });

    res.status(200).json({
      success: true,
      message: `User ${user.deactivated ? "deactivated" : "activated"} successfully`,
      data: { id: user._id, deactivated: user.deactivated },
    });
  } catch (err) {
    return respondWithAdminInternalError(res, err);
  }
};

