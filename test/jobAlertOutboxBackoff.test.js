import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import JobAlertOutbox from '../src/models/JobAlertOutbox.js';
import { recoverJobAlertOutbox } from '../src/services/jobAlertOutboxService.js';

for (const entry of [
  { name: 'successful paging claims do not count as failed attempts', claims: 20, failures: 0, delay: 60000 },
  { name: 'actual failed attempts retain exponential backoff', claims: 20, failures: 3, delay: 480000 },
  { name: 'legacy receipts without a failure counter start with the initial delay', claims: 1, delay: 60000 },
]) test(entry.name, async t => {
  const now = Date.UTC(2026, 10, 10);
  t.mock.timers.enable({ apis: ['Date'], now });
  const event = { _id: new mongoose.Types.ObjectId(), claimToken: 'local-claim',
    attemptCount: entry.claims, failedAttemptCount: entry.failures };
  let update;
  t.mock.method(JobAlertOutbox, 'findOneAndUpdate', async () => event);
  t.mock.method(mongoose.connection, 'transaction', async () => { throw new Error('controlled page failure'); });
  t.mock.method(JobAlertOutbox, 'updateOne', async (filter, value) => {
    assert.equal(filter.claimToken, event.claimToken); update = value; return { modifiedCount: 1 };
  });
  assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 0, failed: 1 });
  assert.equal(update.$set.nextAttemptAt.getTime() - now, entry.delay);
  assert.equal(update.$inc.failedAttemptCount, 1);
});
