import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import JobAlertDelivery from "../models/JobAlertDelivery.js";
import Job from "../models/Job.js";
import { ALERT_FREQUENCIES, ALERT_WEEKDAYS, ALERT_TIME_PATTERN, DEFAULT_ALERT_TIME, DEFAULT_ALERT_DAY } from "../constants/alertSchedule.js";

export { ALERT_FREQUENCIES };
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

export const normalizeAlertSchedule = (subscription) => {
  // Preserve saved daily/weekly schedules and pause state. Immediate accounts
  // move to daily delivery; a version change reschedules their pending rows.
  const source = subscription?.telegramSchedule ?? subscription;
  return {
    frequency: ALERT_FREQUENCIES.includes(source?.frequency) ? source.frequency : "daily",
    isActive: source?.isActive !== false,
    version: (source?.scheduleVersion ?? 0) + (source?.frequency === "immediate" ? 1 : 0),
    deliveryTime: ALERT_TIME_PATTERN.test(source?.deliveryTime) ? source.deliveryTime : DEFAULT_ALERT_TIME,
    weeklyDay: ALERT_WEEKDAYS.includes(source?.weeklyDay) ? source.weeklyDay : DEFAULT_ALERT_DAY,
  };
};

export const getNextAlertDeliveryAt = (frequency, now = new Date(), { deliveryTime = DEFAULT_ALERT_TIME, weeklyDay = DEFAULT_ALERT_DAY } = {}) => {
  if (!ALERT_FREQUENCIES.includes(frequency) || !ALERT_TIME_PATTERN.test(deliveryTime) || !ALERT_WEEKDAYS.includes(weeklyDay)) {
    throw new TypeError("Choose a valid frequency, time and weekday.");
  }
  const reference = new Date(now);
  // Compute the calendar day in IST before translating back to UTC. This also
  // handles local midnight, whose UTC timestamp falls on the preceding day.
  const local = new Date(reference.getTime() + IST_OFFSET_MS);
  const [hours, minutes] = deliveryTime.split(":").map(Number);
  const nextLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hours, minutes));
  if (frequency === "weekly") nextLocal.setUTCDate(nextLocal.getUTCDate() + ((ALERT_WEEKDAYS.indexOf(weeklyDay) - nextLocal.getUTCDay() + 7) % 7));
  let next = nextLocal.getTime() - IST_OFFSET_MS;
  if (next <= reference.getTime()) next += DAY_MS * (frequency === "weekly" ? 7 : 1);
  return new Date(next);
};

export const loadAlertSchedule = async (userId) => Subscription.findOne({ user: userId }).lean().exec();

export const toPublicAlertSchedule = (subscription, now = new Date()) => {
  const schedule = normalizeAlertSchedule(subscription);
  return {
    frequency: schedule.frequency,
    isActive: schedule.isActive,
    timeZone: "Asia/Kolkata",
    deliveryTime: schedule.deliveryTime ?? DEFAULT_ALERT_TIME,
    weeklyDay: schedule.weeklyDay ?? DEFAULT_ALERT_DAY,
    nextDeliveryAt: schedule.isActive
      ? getNextAlertDeliveryAt(schedule.frequency, now, schedule).toISOString() : null,
    lastSentAt: subscription?.telegramLastSentAt ?? null,
  };
};

export const updateAlertSchedule = async (userId, { frequency, isActive, deliveryTime = DEFAULT_ALERT_TIME, weeklyDay = DEFAULT_ALERT_DAY }, now = new Date()) => {
  if (!ALERT_FREQUENCIES.includes(frequency) || typeof isActive !== "boolean" || !ALERT_TIME_PATTERN.test(deliveryTime) || !ALERT_WEEKDAYS.includes(weeklyDay)) {
    throw new TypeError("Choose daily or weekly delivery and a valid enabled state.");
  }
  return mongoose.connection.transaction(async (session) => {
    const current = await Subscription.findOne({ user: userId }).session(session).lean().exec();
    const update = { $set: { telegramSchedule: { frequency, isActive, deliveryTime, weeklyDay,
      scheduleVersion: normalizeAlertSchedule(current).version + 1 } } };
    const subscription = await Subscription.findOneAndUpdate(
      { user: userId },
      update,
      { upsert: true, new: true, runValidators: true, session },
    ).lean().exec();
    const schedule = normalizeAlertSchedule(subscription);
    await JobAlertDelivery.updateMany(
      { user: userId, channel: "telegram", status: "queued" },
      { $set: {
        scheduledFor: getNextAlertDeliveryAt(frequency, now, schedule),
        schedulePaused: !isActive,
        scheduleVersion: schedule.version,
      } },
      { session },
    );
    return subscription;
  });
};

// Queue insertion and cadence changes both write the same subscription document.
// MongoDB retries conflicting transactions, so a late insertion cannot retain
// an obsolete pause/cadence after the settings request has committed.
const queueDeliveries = async (user, jobs, channel, now = new Date(), { session: outerSession } = {}) => {
  const insert = async (session) => {
    const subscription = await Subscription.findOneAndUpdate(
      { user: user._id },
      { $inc: { dispatchRevision: 1 }, $setOnInsert: { telegramSchedule: {} } },
      { upsert: true, new: true, session, timestamps: false },
    ).lean().exec();
    const schedule = normalizeAlertSchedule(subscription);
    const created = [];
    for (const job of jobs) {
      const payload = {
        user: user._id, job: job._id, channel, status: "queued",
        scheduledFor: getNextAlertDeliveryAt(schedule.frequency, now, schedule),
        schedulePaused: !schedule.isActive,
        scheduleVersion: schedule.version,
        jobSnapshot: {
          title: job.title || null, company: job.company || null,
          location: job.city || job.location || null,
          jobUrl: job.jobUrl || job.applyUrl || job.sourceUrl || job.link || null,
        },
      };
      const result = await JobAlertDelivery.updateOne(
        { user: user._id, job: job._id, channel },
        { $setOnInsert: payload },
        { upsert: true, session },
      );
      if (result.upsertedId) created.push({ delivery: { _id: result.upsertedId, ...payload }, job });
    }
    return created;
  };
  // Outbox fanout owns the surrounding transaction and must commit its receipt
  // with these rows. External sends and orphan cleanup happen after commit.
  if (outerSession) return insert(outerSession);
  const created = await mongoose.connection.transaction(insert);
  if (!created.length) return created;
  // Validate after commit: a purge may have deleted jobs while this queue
  // transaction was still inserting deliveries from its earlier snapshot.
  const existing = new Set((await Job.find({ _id: { $in: created.map(row => row.job._id) } }).select('_id').lean()).map(job => String(job._id)));
  const orphaned = created.filter(row => !existing.has(String(row.job._id)));
  if (orphaned.length) await JobAlertDelivery.deleteMany({ _id: { $in: orphaned.map(row => row.delivery._id) } });
  return created.filter(row => existing.has(String(row.job._id)));
};

export const alertScheduleService = {
  queueDeliveries,
  getSchedule: async (userId) => normalizeAlertSchedule(await loadAlertSchedule(userId)),
  requeueClaimed: (userId, deliveryIds, claimToken, now = new Date()) => mongoose.connection.transaction(async (session) => {
    // Serialize with pause/resume and fresh queue insertion. A worker's earlier
    // schedule snapshot may already be obsolete by the time it releases a claim.
    const subscription = await Subscription.findOneAndUpdate(
      { user: userId }, { $inc: { dispatchRevision: 1 }, $setOnInsert: { telegramSchedule: {} } },
      { upsert: true, new: true, session, timestamps: false },
    ).lean().exec();
    const schedule = normalizeAlertSchedule(subscription);
    return JobAlertDelivery.updateMany(
      { _id: { $in: deliveryIds }, user: userId, status: "processing", claimToken },
      { $set: {
        status: "queued", lastAttemptAt: null,
        scheduledFor: getNextAlertDeliveryAt(schedule.frequency, now, schedule),
        schedulePaused: !schedule.isActive, scheduleVersion: schedule.version,
        claimToken: null, claimExpiresAt: null,
      } },
      { session },
    );
  }),
  markSent: (userId, sentAt) => Subscription.updateOne(
    { user: userId }, { $max: { telegramLastSentAt: sentAt } }, { timestamps: false },
  ),
};
