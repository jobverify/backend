import { randomInt, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import TelegramBroadcastSettings from '../models/TelegramBroadcastSettings.js';
import TelegramChannelDelivery from '../models/TelegramChannelDelivery.js';
import TelegramChannelSchedule from '../models/TelegramChannelSchedule.js';
import { getTelegramProvider, isTelegramDeliveryEnabled } from './telegramProvider.js';
import { getActiveBroadcastSettings, jobMatchesBroadcastFilters } from './telegramBroadcastSettingsService.js';
import { renderBroadcastTemplate } from './telegramBroadcastTemplate.js';
import { isAggregateHiringSignalJob } from '../utils/jobListingEvidence.js';
import { isBroadcastWindowOpen, nextBroadcastWindowAt } from './telegramBroadcastWindow.js';

const LEASE_MS = 5 * 60_000;
export const nextChannelPostAt = (now = new Date(), choose = randomInt, settings = {}) => {
  const { minIntervalMinutes = 20, maxIntervalMinutes = 30 } = settings;
  return nextBroadcastWindowAt(new Date(now.getTime()
    + choose(minIntervalMinutes * 60_000, maxIntervalMinutes * 60_000 + 1)), settings);
};

async function destinations(session) {
  const unique = new Map();
  for (const cfg of await getActiveBroadcastSettings({ session })) {
    if (Number.isInteger(cfg.revision) && cfg.revision >= 1 && !unique.has(cfg.chatId)) unique.set(cfg.chatId, cfg);
  }
  return [...unique.values()];
}

const currentSettings = cfg => ({ _id: cfg.id, enabled: true, chatId: cfg.chatId, revision: cfg.revision });
const matches = (job, cfg) => job && job.status === 'active' && !isAggregateHiringSignalJob(job)
  && jobMatchesBroadcastFilters(job, cfg);

export async function stageTelegramChannelDeliveries(jobs = [], { session: outerSession } = {}) {
  if (!jobs.length) return;
  const stageTarget = async (cfg, session) => {
    const selected = jobs.filter(job => matches(job, cfg));
    if (!selected.length) return;
    // A settings save and publication fanout must serialize on the same record.
    const allowed = await TelegramBroadcastSettings.updateOne(currentSettings(cfg),
      { $inc: { dispatchRevision: 1 } }, { session });
    if (!allowed.matchedCount) return;
    const now = new Date();
    await TelegramChannelSchedule.updateOne({ _id: cfg.chatId },
      { $setOnInsert: { nextPostAt: nextChannelPostAt(now, randomInt, cfg) } }, { upsert: true, session });
    for (const job of selected) {
      await TelegramChannelDelivery.updateOne({ channel: cfg.chatId, job: job._id },
        { $setOnInsert: { status: 'queued', destination: cfg.id, configRevision: cfg.revision } }, { upsert: true, session });
    }
  };
  const stage = async session => {
    // Operations sharing a MongoDB transaction must remain sequential.
    // Read settings inside the source transaction, including automatic retries.
    for (const cfg of await destinations(session)) await stageTarget(cfg, session);
  };
  if (outerSession) return stage(outerSession);
  return mongoose.connection.transaction(stage);
}

export async function recoverTelegramChannelAlerts({ provider = getTelegramProvider() } = {}) {
  if (!isTelegramDeliveryEnabled()) return;
  const errors = [];
  for (const cfg of await destinations()) {
    try { await recoverDestination(cfg, provider); }
    catch (error) { errors.push(error); }
  }
  if (errors.length) throw errors[0];
}

async function recoverDestination(cfg, provider) {
  const now = new Date();
  const token = randomUUID();
  const lease = await TelegramChannelSchedule.findOneAndUpdate({ _id: cfg.chatId,
    nextPostAt: { $lte: now }, $or: [{ claimToken: null }, { claimExpiresAt: { $lte: now } }] },
  { $set: { claimToken: token, claimExpiresAt: new Date(now.getTime() + LEASE_MS) } }, { new: true }).lean();
  if (!lease) return;
  const owned = { _id: cfg.chatId, claimToken: token };
  const release = async (nextPostAt, changes = {}, session) => {
    const result = await TelegramChannelSchedule.updateOne(owned,
      { $set: { nextPostAt: nextBroadcastWindowAt(nextPostAt, cfg), claimToken: null, claimExpiresAt: null, ...changes } }, { session });
    if (!result.matchedCount) throw new Error('Channel posting lease was lost.');
  };
  // Telegram has no sendMessage idempotency key. A crashed/ambiguous send must
  // not be replayed automatically; it may already be visible in the channel.
  // Settings may have changed between discovery and acquiring this chat's lease.
  cfg = (await destinations()).find(current => current.id === cfg.id && current.chatId === cfg.chatId);
  if (!cfg) { await release(new Date(Date.now() + 60_000)); return; }
  const interrupted = await TelegramChannelDelivery.updateMany({ channel: cfg.chatId, status: 'sending' },
    { $set: { status: 'uncertain', reason: 'interrupted_send' } });
  if (interrupted.modifiedCount) { await release(nextChannelPostAt(new Date(), randomInt, cfg)); return; }
  if (!isBroadcastWindowOpen(new Date(), cfg)) { await release(new Date()); return; }
  for (let checked = 0; checked < 20; checked++) {
    const delivery = await TelegramChannelDelivery.findOne({ channel: cfg.chatId, status: 'queued',
      $or: [{ retryAt: null }, { retryAt: { $lte: new Date() } }] }).sort({ createdAt: 1, _id: 1 }).lean();
    if (!delivery) break;
    // Historical queues were derived from member settings. They cannot be
    // adopted silently by a newly enabled public broadcast configuration.
    if (!Number.isInteger(delivery.configRevision) || delivery.configRevision < 1) {
      await TelegramChannelDelivery.updateOne({ _id: delivery._id, status: 'queued' },
        { $set: { status: 'skipped', reason: 'legacy_configuration' } });
      continue;
    }
    const job = await Job.findById(delivery.job).lean();
    if (!matches(job, cfg)) {
      await TelegramChannelDelivery.updateOne({ _id: delivery._id, status: 'queued' },
        { $set: { status: 'skipped', reason: 'job_unavailable_or_filters_changed' } });
      continue;
    }
    const body = renderBroadcastTemplate(cfg.template, job);
    const started = await mongoose.connection.transaction(async session => {
      const liveLease = await TelegramChannelSchedule.exists({ ...owned, claimExpiresAt: { $gt: new Date() } }).session(session);
      if (!liveLease) return false;
      // Administrative saves also write the settings and schedule. This write
      // prevents a stale configuration from starting a send after such a save.
      const active = await TelegramBroadcastSettings.updateOne(currentSettings(cfg),
        { $inc: { dispatchRevision: 1 } }, { session });
      if (!active.matchedCount) return false;
      if (!isBroadcastWindowOpen(new Date(), cfg)) return false;
      const result = await TelegramChannelDelivery.updateOne({ _id: delivery._id, status: 'queued' },
        { $set: { status: 'sending', lastAttemptAt: new Date(), reason: null,
          destination: cfg.id, configRevision: cfg.revision } }, { session });
      return result.modifiedCount > 0;
    });
    if (!started) { await release(new Date(Date.now() + 60_000)); return; }
    // A transaction can finish after the window closes. No provider call has
    // happened yet, so it is safe to return this receipt to the queue.
    if (!isBroadcastWindowOpen(new Date(), cfg)) {
      await mongoose.connection.transaction(async session => {
        await TelegramChannelDelivery.updateOne({ _id: delivery._id, status: 'sending' },
          { $set: { status: 'queued', retryAt: null } }, { session });
        await release(new Date(), {}, session);
      });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    timeout.unref?.();
    let result;
    try {
      result = await provider.sendTextMessage({ chatId: cfg.chatId, body, signal: controller.signal });
    } catch (error) {
      // A malformed HTTP 200 or a 5xx response can follow an accepted send.
      // Retry only known rejection responses; do not risk publishing twice.
      const rejected = [400, 401, 403, 404, 429].includes(error?.statusCode);
      const next = nextChannelPostAt(new Date(), randomInt, cfg);
      const retryAt = nextBroadcastWindowAt(new Date(Math.max(next.getTime(), Date.now() + (error?.retryAfterSeconds || 0) * 1000)), cfg);
      await mongoose.connection.transaction(async session => {
        await TelegramChannelDelivery.updateOne({ _id: delivery._id, status: 'sending' }, { $set: {
          status: rejected ? 'queued' : 'uncertain', retryAt,
          reason: rejected ? 'provider_rejected' : 'send_outcome_unknown',
        } }, { session });
        await release(retryAt, {}, session);
      });
      return;
    } finally { clearTimeout(timeout); }
    const sentAt = new Date();
    await mongoose.connection.transaction(async session => {
      await TelegramChannelDelivery.updateOne({ _id: delivery._id, status: 'sending' }, { $set: {
        status: 'sent', sentAt, retryAt: null, providerMessageId: result.providerMessageId,
      } }, { session });
      await release(nextChannelPostAt(sentAt, randomInt, cfg), { lastSentAt: sentAt }, session);
    });
    return;
  }
  await release(new Date(Date.now() + 60_000));
}
