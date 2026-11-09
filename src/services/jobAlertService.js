/**
 * @file Telegram-only matching, queueing, and delivery for job alerts.
 */

import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import JobAlertDelivery from "../models/JobAlertDelivery.js";
import { canUseTelegramAlerts } from "../utils/accessControl.js";
import { isAggregateHiringSignalJob } from "../utils/jobListingEvidence.js";
import { hasSavedFilters, jobMatchesSavedFilters } from "./jobFilterMatcher.js";
import { normalizeProfilePreferenceFilters } from "../utils/profilePreferenceFilters.js";
import { alertScheduleService } from "./alertScheduleService.js";
import { getTelegramProvider, isTelegramDeliveryEnabled } from "./telegramProvider.js";
import { resolveFrontendOrigin } from "../utils/runtimeConfig.js";
import { getSiteSettings } from "./siteSettingsService.js";
import { normalizePublicJobCategory } from "../utils/publicJobNormalization.js";
import { renderBroadcastTemplate } from './telegramBroadcastTemplate.js';

const MAX_JOBS_PER_MESSAGE = 1;
const CLAIM_TTL_MS = 5 * 60 * 1000;
const SEND_TIMEOUT_MS = 60 * 1000;
const RECOVERY_LIMIT = 500;
const TELEGRAM_MESSAGE_FOOTER = [
  'Follow Jobverify 📈 channel for more jobs',
  'http://bit.ly/4aATqJE',
  'https://t.me/jobverifychannel',
  '',
  'Join Jobverify 📈 Group for discussion',
  'https://bit.ly/4kI5HAJ',
  'https://t.me/jobverifygroup',
].join('\n');

const compactText = (value, limit) => {
  const text = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 1)).replace(/[\uD800-\uDBFF]$/u, '') + '\u2026';
};

export function telegramJobLink(job) {
  for (const value of [job.jobUrl, job.applicationUrl, job.applyUrl, job.sourceUrl, job.link]) {
    try {
      const url = new URL(value);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.href.length <= 400) return url.href;
    } catch { /* Try the next stored link. */ }
  }
  // Keep navigation intact when an employer URL is too long.
  let origin;
  try { origin = resolveFrontendOrigin(); } catch { origin = 'https://www.jobverify.in'; }
  return new URL(job._id ? `/jobs/${encodeURIComponent(String(job._id))}` : '/jobs', origin).href;
}

export const buildTelegramMessageBody = (jobs, template) => {
  const job = jobs[0];
  if (!job) return '';
  if (template) return renderBroadcastTemplate(template, job);
  const batches = [...new Set((job.eligibleBatches || [])
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100))]
    .sort((a, b) => a - b).slice(0, 20);
  const category = normalizePublicJobCategory(job);
  const type = /^full[ -]time/i.test(category) ? 'Full time' : category;
  const location = compactText(job.city || job.location, 100);
  const details = [
    ...(batches.length ? [`🎓 Batch :- ${batches.join(', ')}`] : []),
    ...(type && type !== 'Unspecified' ? [`⚙️ Type :- ${compactText(type, 60)}`] : []),
    ...(location ? [`📍 Location :- ${location}`] : []),
  ];
  return [
    `📌 ${compactText(job.company, 100) || 'Company not specified'} is hiring ${compactText(job.title, 160) || 'Role not specified'}`,
    ...(details.length ? ['', ...details] : []),
    '',
    `👔 Job link\n${telegramJobLink(job)}`,
    '',
    TELEGRAM_MESSAGE_FOOTER,
  ].join('\n');
};

const claimFilter = (now = new Date()) => ({
  channel: "telegram",
  schedulePaused: { $ne: true },
  $and: [
    { $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }] },
    { $or: [{ retryAt: null }, { retryAt: { $lte: now } }] },
  ],
  $or: [
    { status: "queued", lastAttemptAt: null },
    { status: "queued", retryAt: { $lte: now } },
    { status: "failed" },
    { status: "processing", claimExpiresAt: { $lte: now } },
  ],
});

const mark = (deliveries, update) => deliveries.length
  ? JobAlertDelivery.updateMany({ _id: { $in: deliveries.map(({ _id }) => _id) }, ...claimFilter() }, { $set: update })
  : Promise.resolve();

const cleanupSentDeliveries = async (ids) => {
  try {
    await JobAlertDelivery.deleteMany({ channel: "telegram", status: "sent",
      ...(ids ? { _id: { $in: ids } } : {}) });
  } catch (error) {
    console.error("[Telegram Alerts] Sent delivery cleanup will retry:", error.message);
  }
};

const retryUpdate = (reason, delayMs) => ({
  status: "queued", reason, lastAttemptAt: new Date(), retryAt: new Date(Date.now() + delayMs),
  claimToken: null, claimExpiresAt: null,
});

const sendWithTimeout = async (provider, payload) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  timeout.unref?.();
  try {
    return await provider.sendTextMessage({ ...payload, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const processRecords = async (user, records) => {
  for (let offset = 0; offset < records.length; offset += MAX_JOBS_PER_MESSAGE) {
    const batch = records.slice(offset, offset + MAX_JOBS_PER_MESSAGE);
    const now = new Date();
    const token = randomUUID();
    let claimed = [];
    for (const { delivery, job } of batch) {
      const claimedDelivery = await JobAlertDelivery.findOneAndUpdate(
        { _id: delivery._id, ...claimFilter(now) },
        { $set: { status: "processing", claimToken: token, claimExpiresAt: new Date(now.getTime() + CLAIM_TTL_MS), reason: null } },
        { new: true, lean: true },
      );
      if (claimedDelivery) claimed.push({ delivery: claimedDelivery, job });
    }
    if (!claimed.length) continue;

    const owned = { _id: { $in: claimed.map(({ delivery }) => delivery._id) }, status: "processing", claimToken: token };

    // Each provider message uses current account, filter and job data. Recovery
    // can span many batches, and a user may disable or disconnect in between.
    const current = await JobAlertDelivery.find(owned).populate("user").populate("job").lean().exec();
    const currentUser = current.find((delivery) => delivery.user)?.user;
    if (!currentUser) {
      await JobAlertDelivery.updateMany(owned, { $set: { status: "skipped", reason: "missing_delivery_context", claimToken: null, claimExpiresAt: null } });
      continue;
    }
    if (currentUser.deactivated || !canUseTelegramAlerts(currentUser, new Date(), await getSiteSettings())) {
      await JobAlertDelivery.updateMany(owned, { $set: retryUpdate("user_ineligible", 60 * 60_000) });
      continue;
    }
    const filters = normalizeProfilePreferenceFilters(currentUser.profile?.telegramAlertFilters);
    const matching = current.filter(({ job }) => job && hasSavedFilters(filters)
      && !isAggregateHiringSignalJob(job) && (!job.status || job.status === "active")
      && jobMatchesSavedFilters({ job, filters, userProfile: currentUser.profile }));
    const matchingIds = new Set(matching.map(({ _id }) => String(_id)));
    const staleIds = claimed.map(({ delivery }) => delivery._id).filter((id) => !matchingIds.has(String(id)));
    if (staleIds.length) await JobAlertDelivery.updateMany({ ...owned, _id: { $in: staleIds } }, { $set: {
      status: "skipped", reason: hasSavedFilters(filters) ? "filters_no_longer_match" : "filters_cleared",
      claimToken: null, claimExpiresAt: null,
    } });
    claimed = matching.map((delivery) => ({ delivery, job: delivery.job }));
    if (!claimed.length) continue;

    const schedule = await alertScheduleService.getSchedule(user._id);
    if (!schedule.isActive || claimed.some(({ delivery }) => (delivery.scheduleVersion ?? 0) !== schedule.version)) {
      await alertScheduleService.requeueClaimed(user._id, claimed.map(({ delivery }) => delivery._id), token, new Date());
      continue;
    }
    if (!isTelegramDeliveryEnabled()) {
      await JobAlertDelivery.updateMany(owned, { $set: retryUpdate("telegram_disabled", 5 * 60_000) });
      continue;
    }
    const body = buildTelegramMessageBody(claimed.map(({ job }) => job), currentUser.profile?.telegramAlertTemplate);
    const attemptCount = Math.max(0, ...claimed.map(({ delivery }) => delivery.attemptCount || 0)) + 1;
    let result;
    try {
      result = await sendWithTimeout(getTelegramProvider(), { chatId: currentUser.telegram.chatId, body });
    } catch (error) {
      const unavailable = error?.chatUnavailable === true;
      if (unavailable) await User.updateOne({ _id: user._id }, { $set: { "premium.telegramAlertsEnabled": false } });
      const backoffMs = unavailable ? 60 * 60_000 : Math.min(60 * 60_000, 60_000 * (2 ** Math.min(attemptCount - 1, 6)));
      const delayMs = Math.max(backoffMs, (error?.retryAfterSeconds || 0) * 1000);
      await JobAlertDelivery.updateMany(owned, { $set: {
        ...retryUpdate(error?.code || "telegram_send_failed", delayMs),
        attemptCount, providerName: "telegram", payloadPreview: body.slice(0, 500),
      } });
      continue;
    }

    // Record the acknowledgement before deleting. Storage/cleanup failures must
    // never be caught as provider failures and turn sent rows into retries.
    const sentAt = new Date();
    await JobAlertDelivery.updateMany(owned, { $set: {
      status: "sent", sentAt, lastAttemptAt: sentAt, retryAt: null, attemptCount,
      providerName: result.providerName, providerMessageId: result.providerMessageId,
      payloadPreview: null, reason: null, claimToken: null, claimExpiresAt: null,
    } });
    await alertScheduleService.markSent(user._id, sentAt).catch((error) => {
      console.error("[Telegram Alerts] Could not update last send time:", error.message);
    });
    await cleanupSentDeliveries(claimed.map(({ delivery }) => delivery._id));
  }
};

export const stageJobAlertDeliveries = async (jobs = [], { session } = {}) => {
  if (!Array.isArray(jobs) || !jobs.length) return [];
  const siteSettings = await getSiteSettings();
  const query = User.find({
    deactivated: false,
    accountDeletingAt: null,
    "premium.telegramAlertsEnabled": true,
    telegramAlertsAllowed: { $ne: false },
    ...(siteSettings.billingEnabled ? { $or: [{ role: "admin" }, { "premium.status": "active" }] } : {}),
  });
  if (session) query.session(session);
  const users = await query.lean().exec();
  const batches = [];
  // MongoDB sessions do not support parallel operations within a transaction.
  for (const user of users) {
    if (!canUseTelegramAlerts(user, new Date(), siteSettings)) continue;
    const filters = normalizeProfilePreferenceFilters(user.profile?.telegramAlertFilters);
    if (!hasSavedFilters(filters)) continue;
    const matching = jobs.filter((job) => !isAggregateHiringSignalJob(job)
      && jobMatchesSavedFilters({ job, filters, userProfile: user.profile }));
    if (!matching.length) continue;
    if (session) {
      // Serialize fanout with account deletion so it cannot recreate private
      // delivery/subscription rows after the account cleanup has finished.
      const owner = await User.updateOne({ _id: user._id, deactivated: false, accountDeletingAt: null },
        { $inc: { __v: 1 } }, { session });
      if (!owner.matchedCount) continue;
    }
    const records = await alertScheduleService.queueDeliveries(user, matching, "telegram", new Date(), { session });
    batches.push({ user, records });
  }
  return batches;
};

export const queueJobAlertsForJobs = async (jobs = []) => {
  const batches = await stageJobAlertDeliveries(jobs);
  for (const { user, records } of batches) await processRecords(user, records);
};

let recoveryInProgress = false;
export const recoverQueuedJobAlerts = async () => {
  if (recoveryInProgress) return;
  recoveryInProgress = true;
  try {
    await cleanupSentDeliveries();
    const dueAt = new Date();
    let cursor;
    // Read bounded pages, but drain the due backlog during this scheduled run.
    // The cursor also advances past deferred/retried rows without looping on them.
    while (true) {
      const filter = claimFilter(dueAt);
      if (cursor) filter.$and.push({ $or: [
        { createdAt: { $gt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $gt: cursor._id } },
      ] });
      const deliveries = await JobAlertDelivery.find(filter).sort({ createdAt: 1, _id: 1 }).limit(RECOVERY_LIMIT).populate("user").populate("job").lean().exec();
      if (!deliveries.length) break;
      cursor = deliveries[deliveries.length - 1];
      const grouped = new Map();
      for (const delivery of deliveries) {
        if (!delivery.user || !delivery.job) {
          await mark([delivery], { status: "skipped", reason: "missing_delivery_context" });
          continue;
        }
        const key = String(delivery.user._id);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push({ delivery, job: delivery.job });
      }
      for (const records of grouped.values()) await processRecords(records[0].delivery.user, records);
      if (deliveries.length < RECOVERY_LIMIT) break;
    }
  } finally {
    recoveryInProgress = false;
  }
};
