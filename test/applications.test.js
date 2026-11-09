import assert from 'node:assert/strict';
import test, { before, beforeEach, after } from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import User from '../src/models/User.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { recordApplicationOpen } from '../src/services/applicationService.js';
import { getApplications, markApplicationApplied } from '../src/controllers/applicationController.js';

const user = '507f1f77bcf86cd799439011';
const jobId = '507f1f77bcf86cd799439012';
const applicationId = '507f1f77bcf86cd799439013';
const job = { _id: jobId, title: 'Frontend Engineer', company: 'Example Corp', location: 'Pune', jobType: 'Full-time', sourceUrl: 'https://example.com/careers/123' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
let mongo;
before(async () => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Application.init(), ApplicationEvent.init()]);
  await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(user), email: 'applications-unit@example.test' });
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => { await Application.deleteMany({}); await ApplicationEvent.deleteMany({}); await TailoredResume.deleteMany({}); });

test('application schema requires ownership and has one record per user and job', () => {
  assert.ok(new Application({}).validateSync().errors.user);
  assert.ok(Application.schema.indexes().some(([keys, options]) => keys.user === 1 && keys.job === 1 && options.unique));
  assert.equal(new Application({ user, job: jobId, jobSnapshot: job }).status, 'opened');
  assert.ok(new Application({ user, job: jobId, jobSnapshot: job, status: 'submitted' }).validateSync().errors.status);
});

test('opening an application saves a server-owned snapshot without confirming it', async () => {
  const now = new Date('2026-10-19T10:00:00Z');
  const row = await recordApplicationOpen(user, job, now);
  assert.equal(row.status, 'opened'); assert.equal(row.stage, 'preparing');
  assert.equal(row.jobSnapshot.title, job.title); assert.equal(row.jobSnapshot.applicationUrl, job.sourceUrl);
  assert.equal(row.appliedAt, null); assert.equal(row.lastOpenedAt.toISOString(), now.toISOString());
  assert.equal(await ApplicationEvent.countDocuments({ application: row._id, kind: 'opened' }), 1);
});

test('concurrent first clicks retain one application and every opening event', async () => {
  const rows = await Promise.all(Array.from({ length: 5 }, () => recordApplicationOpen(user, job)));
  assert.equal(new Set(rows.map(row => String(row._id))).size, 1);
  assert.equal(await Application.countDocuments({ user, job: jobId }), 1);
  assert.equal(await ApplicationEvent.countDocuments({ user, kind: 'opened' }), 5);
});

test('application snapshots fall back to a safe employer source URL', async () => {
  for (const applyUrl of ['', 'invalid', 'http://example.com/apply', 'javascript:alert(1)', 'https://user:password@example.com/apply']) {
    const row = await recordApplicationOpen(user, { ...job, _id: new mongoose.Types.ObjectId(), applyUrl });
    assert.equal(row.jobSnapshot.applicationUrl, job.sourceUrl);
  }
});

test('Applied only updates the authenticated owner and remains idempotent', async () => {
  const row = await recordApplicationOpen(user, job);
  const first = response();
  await markApplicationApplied({ user: { _id: user }, params: { applicationId: String(row._id) } }, first);
  const second = response();
  await markApplicationApplied({ user: { _id: user }, params: { applicationId: String(row._id) } }, second);
  assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 200);
  assert.equal(second.body.data.appliedAt.toISOString(), first.body.data.appliedAt.toISOString());
  assert.equal(await ApplicationEvent.countDocuments({ application: row._id, kind: 'submission_confirmed' }), 1);
});

test('another user cannot confirm an application or create one by confirmation', async () => {
  const other = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: other, email: 'foreign-applications@example.test' });
  const row = await recordApplicationOpen(user, job);
  const foreign = response();
  await markApplicationApplied({ user: { _id: other }, params: { applicationId: String(row._id) } }, foreign);
  assert.equal(foreign.statusCode, 404);
  const missing = response();
  await markApplicationApplied({ user: { _id: user }, params: { applicationId } }, missing);
  assert.equal(missing.statusCode, 404); assert.equal(await Application.countDocuments({}), 1);
});

test('application history is paginated, owner-scoped and retains snapshots without a live job', async () => {
  const rows = await Application.insertMany(Array.from({ length: 25 }, (_, index) => ({
    user, job: new mongoose.Types.ObjectId(), status: index < 2 ? 'applied' : 'opened',
    jobSnapshot: { ...job, applicationUrl: job.sourceUrl }, firstOpenedAt: new Date(Date.UTC(2026, 9, index + 1)),
  })));
  await TailoredResume.collection.insertMany(rows.map(row => ({ _id: `${user}:${row.job}`, user: new mongoose.Types.ObjectId(user), job: row.job, status: 'completed' })));
  const res = response();
  await getApplications({ user: { _id: user }, query: { page: '2', status: 'opened' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.summary, { total: 25, opened: 23, applied: 2 });
  assert.equal(res.body.pagination.totalPages, 12);
  assert.equal(res.body.pagination.limit, 2);
  assert.equal(res.body.data.length, 2); assert.equal(res.body.pagination.total, 23);
  assert.ok(res.body.data.every(item => item.status === 'opened' && item.stage === 'preparing'));
  assert.equal(res.body.data[0].jobSnapshot.applicationUrl, job.sourceUrl);
});

test('application history rejects invalid pagination and status filters', async () => {
  for (const query of [{ page: '0' }, { page: '1.5' }, { status: 'unknown' }, { stage: 'invented' }, { page: { $gt: 0 } }]) {
    const res = response();
    await getApplications({ user: { _id: user }, query }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('application endpoints require authentication and validate confirmation IDs', async () => {
  process.env.JWT_SECRET ||= 'test-secret-'.repeat(4);
  const { default: router } = await import('../src/routes/userRoutes.js');
  for (const path of ['/applications', '/applications/:applicationId/applied']) {
    const route = router.stack.find(layer => layer.route?.path === path)?.route;
    assert.ok(route, path); assert.equal(route.stack[0].name, 'protect');
  }
  const res = response();
  await markApplicationApplied({ user: { _id: user }, params: { applicationId: 'invalid' } }, res);
  assert.equal(res.statusCode, 400);
});
