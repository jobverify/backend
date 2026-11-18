import assert from 'node:assert/strict';
import test from 'node:test';
import PipelineRun from '../src/models/PipelineRun.js';
import JobAlertDelivery from '../src/models/JobAlertDelivery.js';
import { recoverQueuedJobAlerts } from '../src/services/jobAlertService.js';

function setup(t) {
  t.mock.method(PipelineRun, 'findOne', () => ({ sort() { return this; }, select() { return this; }, lean: async () => null }));
  t.mock.method(JobAlertDelivery, 'deleteMany', async () => ({ deletedCount: 0 }));
}

test('bounded recovery leaves unvisited alerts for the next invocation', async t => {
  setup(t);
  let reads = 0; const limits = [];
  t.mock.method(JobAlertDelivery, 'find', () => ({
    sort() { return this; }, limit(value) { limits.push(value); return this; },
    populate() { return this; }, lean() { return this; },
    async exec() { reads++; return [{ _id: 'missing-job', createdAt: new Date() }]; },
  }));
  t.mock.method(JobAlertDelivery, 'updateMany', async () => ({ modifiedCount: 1 }));
  await recoverQueuedJobAlerts({ maxDeliveries: 1 });
  assert.equal(reads, 1);
  assert.deepEqual(limits, [1]);
});

test('expired recovery budget does not query or claim queued alerts', async t => {
  setup(t);
  const find = t.mock.method(JobAlertDelivery, 'find', () => { throw new Error('must not query'); });
  await recoverQueuedJobAlerts({ deadline: Date.now() - 1 });
  assert.equal(find.mock.callCount(), 0);
});
