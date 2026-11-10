import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobAlertOutbox from '../models/JobAlertOutbox.js';
import { findJobAlertRecipientPage, stageJobAlertDeliveries } from './jobAlertService.js';
import { retryMongoOperation } from '../utils/mongoOperationalError.js';
import { stageTelegramChannelDeliveries } from './telegramChannelService.js';

const CLAIM_TTL_MS = 5 * 60_000;
const INGESTION_BATCH_SIZE = 100;
const RECIPIENT_PAGE_SIZE = 100;
const MAX_PAGES_PER_SLICE = 10;
class AlertEventClaimLostError extends Error {}

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

export const processClaimedJobAlertEvent = async event => {
  const owned = { _id: event._id, status: 'processing', claimToken: event.claimToken };
  for (let page = 0; page < MAX_PAGES_PER_SLICE; page++) {
    let result;
    try {
      result = await mongoose.connection.transaction(async session => {
        const now = new Date();
        // Renew and write-fence ownership before reading/staging this page. A stale
        // token cannot commit rows or move the cursor, even after automatic retries.
        const current = await JobAlertOutbox.findOneAndUpdate({ ...owned, claimExpiresAt: { $gt: now } },
          { $set: { claimExpiresAt: new Date(now.getTime() + CLAIM_TTL_MS) } }, { session, new: true }).lean();
        if (!current) return 'lost';
        // A snapshot read alone lets a purge delete the job and its deliveries before
        // this transaction inserts new (possibly paused) deliveries. Write the job so
        // a concurrent purge conflicts/retries instead of leaving orphaned work.
        const job = await Job.findOneAndUpdate({ _id: current.job, status: 'active' }, { $inc: { __v: 1 } },
          { session, new: true, timestamps: false }).lean();
        const available = job?.status === 'active';
        let upperBound = current.recipientUpperBound;
        let cursor = current.recipientCursor;
        let terminal = !available;
        if (available) {
          if (!current.recipientScanInitialized) {
            const last = await findJobAlertRecipientPage({ session, descending: true, limit: 1 });
            upperBound = last[0]?._id ?? null;
          }
          const recipients = upperBound
            ? await findJobAlertRecipientPage({ session, after: cursor, through: upperBound, limit: RECIPIENT_PAGE_SIZE }) : [];
          await stageJobAlertDeliveries([job], { session, recipients });
          if (recipients.length) cursor = recipients[recipients.length - 1]._id;
          terminal = recipients.length < RECIPIENT_PAGE_SIZE || String(cursor) === String(upperBound);
          // Public deliveries share only the terminal page's completion commit.
          if (terminal) await stageTelegramChannelDeliveries([job], { session });
        }
        const release = !terminal && page === MAX_PAGES_PER_SLICE - 1;
        // Each page and its cursor share one commit. Cleaned sent rows behind this
        // cursor must never be recreated by retries or a restarted worker.
        const progress = { recipientScanInitialized: true, recipientUpperBound: upperBound ?? null,
          recipientCursor: cursor ?? null, lastError: '' };
        if (terminal) Object.assign(progress, {
          status: 'completed', completedAt: new Date(), outcome: available ? 'matched' : 'job_unavailable',
          claimToken: null, claimExpiresAt: null,
        });
        else if (release) Object.assign(progress, { status: 'pending', nextAttemptAt: new Date(), claimToken: null, claimExpiresAt: null });
        const committed = await JobAlertOutbox.updateOne({ ...owned, claimExpiresAt: { $gt: new Date() } },
          { $set: progress }, { session });
        if (!committed.matchedCount) throw new AlertEventClaimLostError('Alert event claim expired before commit.');
        return terminal ? 'completed' : release ? 'partial' : 'continue';
      });
    } catch (error) {
      if (error instanceof AlertEventClaimLostError) return false;
      throw error;
    }
    if (result !== 'continue') return result === 'completed';
  }
  return false;
};

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
      // Successful partial slices require new claims; they are not failures.
      const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(event.failedAttemptCount ?? 0, 6));
      await JobAlertOutbox.updateOne({ _id: event._id, status: 'processing', claimToken: event.claimToken }, { $set: {
        status: 'pending', nextAttemptAt: new Date(Date.now() + delay), claimToken: null, claimExpiresAt: null,
        // Persist a safe category, never job text, connection strings or tokens.
        lastError: Number.isInteger(error?.code) ? `database_${error.code}` : 'fanout_failed',
      }, $inc: { failedAttemptCount: 1 } });
    }
  }
  return { completed, failed };
};
