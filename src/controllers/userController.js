/**
 * @file Controllers for fetching and updating authenticated user profiles.
 * @module controllers/userController
 */

import Job from "../models/Job.js";
import TailoredResume from '../models/TailoredResume.js';
import Subscription from "../models/Subscription.js";
import TelegramLinkToken from "../models/TelegramLinkToken.js";
import User from "../models/User.js";
import { BROADCAST_TOKENS, DEFAULT_BROADCAST_TEMPLATE, BROADCAST_SAMPLE_JOBS, renderBroadcastTemplate, validateBroadcastTemplate } from '../services/telegramBroadcastTemplate.js';
import { normalizePreferredJobType } from "../constants/preferredJobTypes.js";
import { ACCESS_ROLES } from "../constants/accessPlans.js";
import {
  deriveLegacyProfilePreferences,
  normalizeProfilePreferenceFilters,
} from "../utils/profilePreferenceFilters.js";
import {
  applyExpiredAccessDowngrade,
  buildAccessSummary,
  canUseTelegramAlerts,
} from "../utils/accessControl.js";
import { normalizeJobListResponseJob } from "./jobController.js";
import { applyPublicJobVisibility } from "../utils/publicJobVisibility.js";
import { respondWithInternalError } from "../utils/respondWithInternalError.js";
import { createTelegramLinkToken } from "../services/telegramLinkService.js";
import { clearAuthCookie } from "../utils/authCookies.js";
import { removeUserAccount } from "../services/userAccountDeletion.js";

const MAX_PROFILE_TEXT_LENGTH = 80;
const MAX_PROFILE_ITEMS = 20;

const normalizeProfileText = (value) =>
  String(value ?? "").trim().slice(0, MAX_PROFILE_TEXT_LENGTH);

const normalizeProfileList = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(
    list
      .map((item) => normalizeProfileText(item))
      .filter(Boolean),
  )].slice(0, MAX_PROFILE_ITEMS);
};

const normalizePreferredJobTypes = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(
    list
      .map((item) => normalizePreferredJobType(item))
      .filter(Boolean),
  )].slice(0, MAX_PROFILE_ITEMS);
};

const normalizePassingYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) ? year : undefined;
};

const getSavedJobIds = (user) => (user.savedJobs ?? []).map((jobId) => String(jobId));

const buildSavedJobsFilter = (savedJobIds, siteSettings) => applyPublicJobVisibility({
  _id: { $in: savedJobIds },
  status: "active",
}, siteSettings);

const respondWithUserInternalError = (res, error) => (
  respondWithInternalError(res, error, {
    code: 500,
    logLabel: "[userController] Request failed:",
  })
);

const countAvailableSavedJobs = async (user, siteSettings) => {
  const savedJobIds = getSavedJobIds(user);

  if (savedJobIds.length === 0) {
    return 0;
  }

  return Job.countDocuments(buildSavedJobsFilter(savedJobIds, siteSettings));
};

const buildProfileOverview = (user, savedJobsCount = user.savedJobs?.length ?? 0) => ({
  savedJobs: savedJobsCount,
});

const TELEGRAM_ELIGIBLE_ACCESS_ROLES = new Set([
  ACCESS_ROLES.SEMESTER,
  ACCESS_ROLES.YEARLY,
]);

const revokeUnusedTelegramLinks = (userId, now = new Date()) =>
  TelegramLinkToken.updateMany(
    { user: userId, consumedAt: null },
    { $set: { consumedAt: now } },
  );

const issueTelegramLinkToken = async (userId) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const now = new Date();
    await revokeUnusedTelegramLinks(userId, now);

    try {
      return await createTelegramLinkToken(userId, now);
    } catch (error) {
      if (error?.code !== 11000 || attempt === maxAttempts) throw error;
    }
  }

  throw new Error("Unable to issue a Telegram link token.");
};

const hasTelegramEligibility = (user, siteSettings) =>
  siteSettings?.billingEnabled === false
  || user.role === "admin"
  || (
    TELEGRAM_ELIGIBLE_ACCESS_ROLES.has(user.accessRole)
    && user.premium?.status === "active"
  );

const hasLinkedTelegram = (user) => {
  const linkedAt = user.telegram?.linkedAt;
  const optedOutAt = user.telegram?.optedOutAt;

  return Boolean(
    user.telegram?.chatId
    && linkedAt
    && (
      !optedOutAt
      || new Date(linkedAt).getTime() > new Date(optedOutAt).getTime()
    ),
  );
};

const persistExpiredAccessDowngrade = async (user) => {
  if (!applyExpiredAccessDowngrade(user)) return false;

  await Subscription.updateOne(
    { user: user._id },
    { $set: { isActive: false } },
  ).catch(() => null);
  await user.save();
  return true;
};

const buildTelegramAlertSettingsData = (user, siteSettings) => ({
  template: user.profile?.telegramAlertTemplate || DEFAULT_BROADCAST_TEMPLATE,
  defaultTemplate: DEFAULT_BROADCAST_TEMPLATE,
  tokens: BROADCAST_TOKENS,
  linked: hasLinkedTelegram(user),
  username: user.telegram?.username ?? null,
  linkedAt: user.telegram?.linkedAt ?? null,
  optedOutAt: user.telegram?.optedOutAt ?? null,
  enabled: Boolean(user.premium?.telegramAlertsEnabled),
  canUseTelegramAlerts: canUseTelegramAlerts(user, new Date(), siteSettings),
  accessRole: user.accessRole,
  access: buildAccessSummary(user),
  telegramAlertFilters: normalizeProfilePreferenceFilters(
    user.profile?.telegramAlertFilters,
  ),
});

const buildProfilePayload = (user, savedJobsCount) => ({
  code: 200,
  success: true,
  message: "User profile retrieved successfully",
  id: user._id,
  email: user.email,
  role: user.role,
  accessRole: user.accessRole,
  access: buildAccessSummary(user),
  profile: user.profile,
  profileOverview: buildProfileOverview(user, savedJobsCount),
  onboardingCompleted: user.onboardingCompleted,
  lastLoginAt: user.lastLoginAt,
});

// Retrieves the profile details of the authenticated user.
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      if (applyExpiredAccessDowngrade(user)) {
        await Subscription.updateOne(
          { user: user._id },
          { $set: { isActive: false } },
        ).catch(() => null);
        await user.save();
      }

      const savedJobsCount = await countAvailableSavedJobs(user, req.siteSettings);

      res.status(200).json(buildProfilePayload(user, savedJobsCount));
    } else {
      res.status(404).json({
        code: 404,
        success: false,
        message: "User not found"
      });
    }
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

// Updates individual profile fields and automatically tracks onboarding completion.
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      // Update profile fields if provided
      if (req.body.name !== undefined) user.profile.name = normalizeProfileText(req.body.name);
      if (req.body.graduateEducation !== undefined) user.profile.graduateEducation = normalizeProfileText(req.body.graduateEducation);
      if (req.body.branch !== undefined) user.profile.branch = normalizeProfileText(req.body.branch);
      if (req.body.passingYear !== undefined) {
        const passingYear = normalizePassingYear(req.body.passingYear);
        if (passingYear !== undefined) user.profile.passingYear = passingYear;
      }
      if (req.body.preferredJobTypes !== undefined) {
        user.profile.preferredJobTypes = normalizePreferredJobTypes(req.body.preferredJobTypes);
      }
      if (req.body.locationPreference !== undefined) {
        user.profile.locationPreference = normalizeProfileList(req.body.locationPreference);
      }
      if (req.body.profilePreferenceFilters !== undefined) {
        const normalizedFilters = normalizeProfilePreferenceFilters(req.body.profilePreferenceFilters);
        const compatibility = deriveLegacyProfilePreferences(normalizedFilters);

        user.profile.profilePreferenceFilters = normalizedFilters;
        user.profile.locationPreference = compatibility.locationPreference;
        user.profile.preferredJobTypes = compatibility.preferredJobTypes;
      }

      // Ensure profile defaults are maintained if object properties are missing
      // user.profile is a nested schema, so modification tracking handles subdoc changes.
      user.onboardingCompleted = Boolean(
        user.profile.branch &&
        user.profile.passingYear &&
        user.profile.preferredJobTypes?.length > 0 &&
        user.profile.locationPreference?.length > 0
      );
      if (applyExpiredAccessDowngrade(user)) {
        await Subscription.updateOne(
          { user: user._id },
          { $set: { isActive: false } },
        ).catch(() => null);
      }
      const updatedUser = await user.save();
      const savedJobsCount = await countAvailableSavedJobs(updatedUser, req.siteSettings);

      res.status(200).json({
        ...buildProfilePayload(updatedUser, savedJobsCount),
        message: "User profile updated successfully",
      });
    } else {
      res.status(404).json({
        code: 404,
        success: false,
        message: "User not found"
      });
    }
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

// Permanently removes the authenticated account and records that identify or track it.
export const deleteUserAccount = async (req, res) => {
  try {
    await removeUserAccount(req.user);
    clearAuthCookie(res);

    res.status(200).json({
      code: 200,
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const getSavedJobs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("savedJobs");

    if (!user) {
      res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
      return;
    }

    const savedJobIds = getSavedJobIds(user);

    if (savedJobIds.length === 0) {
      res.status(200).json({
        code: 200,
        success: true,
        message: "Saved jobs retrieved successfully",
        data: [],
        profileOverview: buildProfileOverview(user, 0),
      });
      return;
    }

    const jobs = await Job.find(buildSavedJobsFilter(savedJobIds, req.siteSettings));

    const jobsById = new Map(jobs.map((job) => [
      String(job._id),
      normalizeJobListResponseJob(job.toObject ? job.toObject() : job),
    ]));
    const availableSavedJobIds = savedJobIds.filter((jobId) => jobsById.has(jobId));

    if (req.siteSettings?.experiencedJobsEnabled !== false && availableSavedJobIds.length !== savedJobIds.length) {
      const unavailableIds = savedJobIds.filter(jobId => !jobsById.has(jobId));
      await User.updateOne({ _id: user._id }, { $pull: { savedJobs: { $in: unavailableIds } } });
      user.savedJobs = availableSavedJobIds;
    }

    const orderedJobs = [...availableSavedJobIds]
      .reverse()
      .map((jobId) => jobsById.get(jobId))
      .filter(Boolean);

    res.status(200).json({
      code: 200,
      success: true,
      message: "Saved jobs retrieved successfully",
      data: orderedJobs,
      profileOverview: buildProfileOverview(user, availableSavedJobIds.length),
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const [user, job] = await Promise.all([
      User.findById(req.user._id),
      Job.findOne(applyPublicJobVisibility({ _id: jobId, status: "active" }, req.siteSettings)),
    ]);

    if (!user) {
      res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
      return;
    }

    if (!job) {
      res.status(404).json({
        code: 404,
        success: false,
        message: "Job not found",
      });
      return;
    }

    const hasSavedJob = (user.savedJobs ?? []).some(
      (savedJobId) => String(savedJobId) === jobId,
    );

    if (!hasSavedJob) {
      user.savedJobs.push(job._id);
      await user.save();
    }

    // A purge can delete this job after the public lookup and before save.
    // Its post-delete sweep covers earlier writes; this check covers late ones.
    if (!await Job.findOne({ _id: job._id }, '_id')) {
      await User.updateOne({ _id: user._id }, { $pull: { savedJobs: job._id } });
      return res.status(404).json({ code: 404, success: false, message: 'Job not found' });
    }

    const savedJobsCount = await countAvailableSavedJobs(user, req.siteSettings);

    res.status(200).json({
      code: 200,
      success: true,
      message: hasSavedJob ? "Job already saved" : "Job saved successfully",
      saved: true,
      jobId,
      profileOverview: buildProfileOverview(user, savedJobsCount),
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const removeSavedJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
      return;
    }

    const nextSavedJobs = (user.savedJobs ?? []).filter(
      (savedJobId) => String(savedJobId) !== jobId,
    );

    // Invalidate before removing membership so a remove/re-save race cannot
    // revive a queued request or let an old worker publish its result.
    await TailoredResume.updateMany({ user: user._id, job: jobId, status: { $in: ['queued', 'running'] } }, {
      $set: { status: 'failed', phase: 'failed', ready: false, error: 'This job was removed from saved jobs. Save it again to generate a new resume.' },
      $inc: { revision: 1 }, $unset: { leaseOwner: 1, leaseUntil: 1 },
    });

    if (nextSavedJobs.length !== user.savedJobs.length) {
      await User.updateOne({ _id: user._id }, { $pull: { savedJobs: jobId } });
      user.savedJobs = nextSavedJobs;
    }

    const savedJobsCount = await countAvailableSavedJobs(user, req.siteSettings);

    res.status(200).json({
      code: 200,
      success: true,
      message: "Saved job removed successfully",
      saved: false,
      jobId,
      profileOverview: buildProfileOverview(user, savedJobsCount),
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const createTelegramAlertLink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
    }

    await persistExpiredAccessDowngrade(user);

    if (!hasTelegramEligibility(user, req.siteSettings)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: "Telegram alerts require an active semester or yearly plan.",
      });
    }

    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || "")
      .trim()
      .replace(/^@/u, "");
    if (!botUsername) {
      return res.status(503).json({
        code: 503,
        success: false,
        message: "Telegram linking is not configured.",
      });
    }

    const { rawToken } = await issueTelegramLinkToken(user._id);

    return res.status(200).json({
      data: {
        deepLink: `https://t.me/${botUsername}?start=${rawToken}`,
      },
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const previewUserTelegramAlert = (req, res) => {
  try {
    const sample = req.body?.sample ?? 'complete';
    if (!Object.hasOwn(BROADCAST_SAMPLE_JOBS, sample)) return res.status(400).json({ success: false, message: 'Choose the complete or minimal sample.' });
    const text = renderBroadcastTemplate(req.body?.template, BROADCAST_SAMPLE_JOBS[sample]);
    return res.json({ success: true, data: { text, characters: text.length,
      sampleLabel: sample === 'complete' ? 'Illustrative sample with source details' : 'Illustrative sample with missing details' } });
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
};

export const getTelegramAlertSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
    }

    await persistExpiredAccessDowngrade(user);

    return res.status(200).json({
      code: 200,
      success: true,
      data: buildTelegramAlertSettingsData(user, req.siteSettings),
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const updateTelegramAlertSettings = async (req, res) => {
  try {
    let template;
    if (req.body.template !== undefined) {
      try { template = validateBroadcastTemplate(req.body.template); }
      catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    }
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
    }

    await persistExpiredAccessDowngrade(user);

    if (req.body.enabled === true && !hasLinkedTelegram(user)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Link a Telegram account before enabling alerts.",
      });
    }

    if (req.body.enabled === true && !hasTelegramEligibility(user, req.siteSettings)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: "Telegram alerts require an active semester or yearly plan.",
      });
    }

    if (req.body.telegramAlertFilters !== undefined) {
      user.profile.telegramAlertFilters = normalizeProfilePreferenceFilters(
        req.body.telegramAlertFilters,
      );
    }

    if (template !== undefined) user.profile.telegramAlertTemplate = template;

    if (req.body.enabled !== undefined) {
      user.premium.telegramAlertsEnabled = req.body.enabled === true;
    }

    await user.save();

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Telegram alert settings updated successfully.",
      data: buildTelegramAlertSettingsData(user, req.siteSettings),
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};

export const deleteTelegramAlertSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "User not found",
      });
    }

    user.telegram.chatId = null;
    user.telegram.username = null;
    user.telegram.linkedAt = null;
    user.telegram.optedOutAt = new Date();
    user.premium.telegramAlertsEnabled = false;
    await user.save();
    await revokeUnusedTelegramLinks(user._id, user.telegram.optedOutAt);

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Telegram account unlinked successfully.",
      data: buildTelegramAlertSettingsData(user, req.siteSettings),
    });
  } catch (error) {
    return respondWithUserInternalError(res, error);
  }
};
