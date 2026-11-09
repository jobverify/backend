import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import Subscription from '../src/models/Subscription.js';
import JobAlertDelivery from '../src/models/JobAlertDelivery.js';
import JobAlertOutbox from '../src/models/JobAlertOutbox.js';
import { alertScheduleService, updateAlertSchedule } from '../src/services/alertScheduleService.js';
import { recoverQueuedJobAlerts } from '../src/services/jobAlertService.js';
import { persistJobChangesWithAlertOutbox, claimJobAlertEvent, processClaimedJobAlertEvent } from '../src/services/jobAlertOutboxService.js';

test('outbox fanout retries a pre-purge snapshot without recreating paused delivery history', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
  });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Job.init(), User.init(), Subscription.init(), JobAlertDelivery.init(), JobAlertOutbox.init()]);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('External sends are forbidden in purge-race verification.'); });

  const user = await User.create({ email: 'paused-purge-race@example.test',
    premium: { planId: 'semester', status: 'active', telegramAlertsEnabled: true },
    telegram: { chatId: 'paused-purge-race-fixture', linkedAt: new Date() },
    profile: { telegramAlertFilters: { company: ['Example'] } },
  });
  await updateAlertSchedule(user._id, { frequency: 'daily', isActive: false, deliveryTime: '10:30', weeklyDay: 'Monday' });
  await persistJobChangesWithAlertOutbox(Job, [{ updateOne: {
    filter: { fingerprint: 'paused-purge-race' },
    update: { $set: { fingerprint: 'paused-purge-race', title: 'Software Engineer', company: 'Example',
      city: 'Bengaluru', sourceUrl: 'https://example.test/jobs/purge-race', status: 'active' } }, upsert: true,
  } }]);
  const event = await claimJobAlertEvent();
  assert.ok(event);

  // The real outbox read establishes a transaction snapshot before the Job
  // query. This hook controls timing only: every query still executes through
  // Mongoose and MongoDB, including the write-conflict retry. Purge before the
  // Job write is issued, so no delete waits behind our own transaction lock.
  const executeJobQuery = Job.Query.prototype.exec;
  let purged = false;
  let jobAttempts = 0;
  t.mock.method(Job.Query.prototype, 'exec', async function (...args) {
    if (this.getOptions().session?.inTransaction()
      && ['findOne', 'findOneAndUpdate'].includes(this.op)
      && String(this.getQuery()._id) === String(event.job)) {
      jobAttempts++;
      if (!purged) {
        purged = true;
        await JobAlertDelivery.deleteMany({ job: event.job });
        assert.equal((await Job.deleteOne({ _id: event.job })).deletedCount, 1);
        // Match the purge's second reference sweep after its job deletion.
        await JobAlertDelivery.deleteMany({ job: event.job });
      }
    }
    return executeJobQuery.apply(this, args);
  });

  assert.equal(await processClaimedJobAlertEvent(event), true);
  assert.equal(purged, true, 'The purge must run after the snapshot is established');
  assert.equal(await Job.countDocuments({ _id: event.job }), 0);
  assert.equal(await JobAlertDelivery.countDocuments({ job: event.job }), 0,
    'A completed purge must not be followed by a paused orphan inserted from the old snapshot');
  assert.ok(jobAttempts >= 2, 'MongoDB must retry the stale transaction at the Job write fence');
  const completed = await JobAlertOutbox.findById(event._id).lean();
  assert.equal(completed.status, 'completed');
  assert.equal(completed.outcome, 'job_unavailable');
  assert.equal((await alertScheduleService.getSchedule(user._id)).isActive, false);

  await recoverQueuedJobAlerts();
  assert.equal(await JobAlertDelivery.countDocuments({ job: event.job }), 0);
  assert.equal(await processClaimedJobAlertEvent(event), false, 'The old claim cannot replay its completed receipt');
});
