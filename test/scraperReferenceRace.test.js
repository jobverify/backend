import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import Click from '../src/models/Click.js';
import Subscription from '../src/models/Subscription.js';
import JobAlertDelivery from '../src/models/JobAlertDelivery.js';
import { saveJob } from '../src/controllers/userController.js';
import { trackJobClick } from '../src/controllers/jobController.js';
import { alertScheduleService } from '../src/services/alertScheduleService.js';
import { updateJobStatus } from '../src/controllers/adminController.js';
import AdminAudit from '../src/models/AdminAudit.js';
import JobDatasetSummary from '../src/models/JobDatasetSummary.js';

const jobId = '507f191e810c19729de860ea';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('a save completing after a purge removes its late job reference', async t => {
  const user = { _id: 'user-1', savedJobs: [], async save() {} };
  t.mock.method(User, 'findById', async () => user);
  let reads = 0;
  t.mock.method(Job, 'findOne', async () => ++reads === 1 ? { _id: jobId } : null);
  t.mock.method(Job, 'countDocuments', async () => 1);
  const writes = [];
  t.mock.method(User, 'updateOne', async (filter, update) => { writes.push({ filter, update }); return { modifiedCount: 1 }; });
  const res = response();
  await saveJob({ user: { _id: user._id }, params: { jobId } }, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(writes.at(-1), { filter: { _id: user._id }, update: { $pull: { savedJobs: jobId } } });
});

test('a click completing after a purge removes its late analytics record', async t => {
  t.mock.method(Click, 'findOne', () => ({ lean() { return this; }, exec: async () => null }));
  t.mock.method(Job, 'findOneAndUpdate', async () => ({ _id: jobId, clickCount: 1 }));
  t.mock.method(Click, 'create', async () => ({}));
  t.mock.method(Job, 'findOne', async () => null);
  const cleanup = t.mock.method(Click, 'deleteMany', async () => ({ deletedCount: 1 }));
  const res = response();
  await trackJobClick({ params: { id: jobId }, headers: {}, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(cleanup.mock.calls[0].arguments, [{ job: jobId }]);
});

test('alert insertion finishing after a purge removes orphaned delivery records', async t => {
  t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
  t.mock.method(Subscription, 'findOneAndUpdate', () => ({ lean() { return this; }, exec: async () => ({}) }));
  t.mock.method(JobAlertDelivery, 'updateOne', async () => ({ upsertedId: 'delivery-1' }));
  t.mock.method(Job, 'find', () => ({ select() { return this; }, lean: async () => [] }));
  const cleanup = t.mock.method(JobAlertDelivery, 'deleteMany', async () => ({ deletedCount: 1 }));
  const queued = await alertScheduleService.queueDeliveries({ _id: 'user-1' }, [{ _id: jobId }], 'telegram');
  assert.deepEqual(queued, []);
  assert.deepEqual(cleanup.mock.calls[0].arguments, [{ _id: { $in: ['delivery-1'] } }]);
});

test('a job status audit completing after a purge removes its late job reference', async t => {
  let reads = 0;
  t.mock.method(Job, 'findById', async () => ++reads === 1 ? { _id: jobId, status: 'active', async save() {} } : null);
  t.mock.method(Job, 'aggregate', () => ({ exec: async () => [] }));
  t.mock.method(JobDatasetSummary, 'findOneAndUpdate', () => ({ lean() { return this; }, exec: async () => ({}) }));
  t.mock.method(AdminAudit, 'create', async () => ({}));
  const cleanup = t.mock.method(AdminAudit, 'deleteMany', async () => ({ deletedCount: 1 }));
  const res = response();
  await updateJobStatus({ params: { id: jobId }, body: { status: 'hidden' }, user: { _id: 'admin-1' } }, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(cleanup.mock.calls[0].arguments, [{ targetType: 'Job', targetId: jobId }]);
});
