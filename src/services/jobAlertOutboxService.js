import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobAlertOutbox from '../models/JobAlertOutbox.js';
import { stageJobAlertDeliveries } from './jobAlertService.js';
import { retryMongoOperation } from '../utils/mongoOperationalError.js';
import { stageTelegramChannelDeliveries } from './telegramChannelService.js';

const CLAIM_TTL_MS = 5 * 60_000;
const INGESTION_BATCH_SIZE = 100;

export const persistJobChangesWithAlertOutbox = async (JobModel, operations, { enqueueAlerts = true, signal } = {}) => {
  if (!operations.length) return { upsertedCount: 0, modifiedCount: 0, upsertedIds: {} };
  // Maintenance callers may explicitly suppress alerts. Normal ingestion has
  // no nontransactional fallback, including on standalone MongoDB servers.
  if (!enqueueAlerts) return JobModel.bulkWrite(operations, { ordered: false });
  const combined = { upsertedCount: 0, modifiedCount: 0, matchedCount: 0, insertedCount: 0, deletedCount: 0, upsertedIds: {} };
  for (let offset = 0; offset < operations.length; offset += INGESTION_BATCH_SIZE) {
    signal?.throwIfAborted();
    // Bound the transaction lifetime while retaining each job's alert obligation.
    // Earlier committed batches are safe to replay after a later batch fails.
    const result = await retryMongoOperation(() => JobModel.db.transaction(async session => {
      const result = await JobModel.bulkWrite(operations.slice(offset, offset + INGESTION_BATCH_SIZE), { ordered: true, session });
      const ids = Object.values(result.upsertedIds ?? {});
      if (ids.length) {
        const jobs = await JobModel.find({ _id: { $in: ids }, status: 'active' }).select('_id').session(session).lean();
        if (jobs.length) await JobAlertOutbox.bulkWrite(jobs.map(job => ({ updateOne: {
          filter: { job: job._id, kind: 'job_published' },
          update: { $setOnInsert: { status: 'pending', nextAttemptAt: new Date() } }, upsert: true,
        } })), { ordered: true, session });
      }
      return result;
    }), { signal });
    for (const key of ['upsertedCount', 'modifiedCount', 'matchedCount', 'insertedCount', 'deletedCount']) combined[key] += result[key] ?? 0;
    for (const [index, id] of Object.entries(result.upsertedIds ?? {})) combined.upsertedIds[offset + Number(index)] = id;
  }
  return combined;
};

export const claimJobAlertEvent = async (now = new Date()) => JobAlertOutbox.findOneAndUpdate({
  $or: [
    { status: 'pending', nextAttemptAt: { $lte: now } },
    { status: 'processing', claimExpiresAt: { $lte: now } },
  ],
}, { $set: { status: 'processing', claimToken: randomUUID(), claimExpiresAt: new Date(now.getTime() + CLAIM_TTL_MS) },
  $inc: { attemptCount: 1 } }, { new: true, sort: { createdAt: 1, _id: 1 }, lean: true });

export const processClaimedJobAlertEvent = async event => mongoose.connection.transaction(async session => {
  const owned = { _id: event._id, status: 'processing', claimToken: event.claimToken };
  const current = await JobAlertOutbox.findOne({ ...owned, claimExpiresAt: { $gt: new Date() } }).session(session).lean();
  if (!current) return false;
  // A snapshot read alone lets a purge delete the job and its deliveries before
  // this transaction inserts new (possibly paused) deliveries. Write the job so
  // a concurrent purge conflicts/retries instead of leaving orphaned work.
  const job = await Job.findOneAndUpdate({ _id: current.job, status: 'active' }, { $inc: { __v: 1 } },
    { session, new: true, timestamps: false }).lean();
  const available = job?.status === 'active';
  if (available) {
    await stageJobAlertDeliveries([job], { session });
    await stageTelegramChannelDeliveries([job], { session });
  }
  // Completion and delivery insertion share one commit. A crash before this
  // commit rolls both back; after it, even deleted sent rows cannot be replayed.
  const result = await JobAlertOutbox.updateOne({ ...owned, claimExpiresAt: { $gt: new Date() } }, { $set: {
    status: 'completed', completedAt: new Date(), outcome: available ? 'matched' : 'job_unavailable',
    claimToken: null, claimExpiresAt: null, lastError: '',
  } }, { session });
  if (!result.modifiedCount) throw new Error('Alert event claim expired before commit.');
  return true;
});

export const recoverJobAlertOutbox = async ({ limit = 50 } = {}) => {
  let completed = 0;
  let failed = 0;
  for (let i = 0; i < Math.max(0, Math.min(500, limit)); i++) {
    const event = await claimJobAlertEvent();
    if (!event) break;
    try {
      if (await processClaimedJobAlertEvent(event)) completed++;
    } catch (error) {
      failed++;
      const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(event.attemptCount - 1, 6));
      await JobAlertOutbox.updateOne({ _id: event._id, status: 'processing', claimToken: event.claimToken }, { $set: {
        status: 'pending', nextAttemptAt: new Date(Date.now() + delay), claimToken: null, claimExpiresAt: null,
        // Persist a safe category, never job text, connection strings or tokens.
        lastError: Number.isInteger(error?.code) ? `database_${error.code}` : 'fanout_failed',
      } });
    }
  }
  return { completed, failed };
};
