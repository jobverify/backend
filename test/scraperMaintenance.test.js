import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import Click from '../src/models/Click.js';
import JobAlertDelivery from '../src/models/JobAlertDelivery.js';
import AdminAudit from '../src/models/AdminAudit.js';
import ScraperStatus from '../src/models/ScraperStatus.js';
import ScraperRun from '../src/models/ScraperRun.js';
import HiringObservation from '../src/models/HiringObservation.js';
import PipelineRun from '../src/models/PipelineRun.js';
import JobDatasetSummary from '../src/models/JobDatasetSummary.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import express from 'express';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';

test('scraper purge removes linked MongoDB data and retains other sources, including a shared company', { timeout: 120000 }, async t => {
  const { purgeScraperData } = await import('../src/services/scraperMaintenance.js');
  assert.equal(typeof purgeScraperData, 'function');
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  await mongoose.connect(mongo.getUri());
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const id = () => new mongoose.Types.ObjectId();
  const scraper = { _id: id(), source: 'selected.scraper', companyName: 'Selected', isActive: true, lastRanAt: new Date(), lastSuccess: false, lastError: 'old failure', lastJobsFound: 99 };
  const selected = id(), shared = id(), retained = id(), admin = id();
  await ScraperStatus.collection.insertOne(scraper);
  await Job.collection.insertMany([
    { _id: selected, fingerprint: 'selected', source: scraper.source, company: 'Selected', status: 'active' },
    { _id: shared, fingerprint: 'shared', source: scraper.source, company: 'Shared', status: 'expired' },
    { _id: retained, fingerprint: 'retained', source: 'other', company: 'Shared', status: 'active' },
  ]);
  await User.collection.insertOne({ savedJobs: [selected, shared, retained], profile: { profilePreferenceFilters: { company: ['Selected', 'Shared'] }, telegramAlertFilters: { company: ['Selected', 'Shared'] } } });
  await Click.collection.insertMany([{ job: selected }, { job: retained }]);
  await JobAlertDelivery.collection.insertMany([{ job: selected }, { job: retained }, { job: id(), jobSnapshot: { company: 'Selected' } }]);
  await AdminAudit.collection.insertMany([
    { admin, targetType: 'Job', targetId: selected }, { admin, targetType: 'ScraperStatus', targetId: scraper._id }, { admin, targetType: 'Job', targetId: retained },
  ]);
  await ScraperRun.collection.insertMany([
    { sources: { 'selected\uFF0Escraper': { success: true, jobsFound: 5 }, other: { success: true, jobsFound: 8 } }, overall: { totalJobs: 13, sourcesSucceeded: 2, sourcesFailed: 0 } },
    { sources: { 'selected.scraper': { success: false, jobsFound: 0 } } },
  ]);
  await HiringObservation.collection.insertMany([{ _id: 'affected', key: 'affected', companies: [{ label: 'Selected', count: 5 }] }, { _id: 'retained', key: 'retained', companies: [{ label: 'Other', count: 7 }] }]);
  await JobDatasetSummary.collection.insertOne({ key: 'old-summary', companies: ['Selected'] });

  const result = await purgeScraperData(scraper);
  assert.equal(result.deletedCount, 2);
  assert.deepEqual((await Job.find().lean()).map(job => job.source), ['other']);
  const user = await User.findOne().lean();
  assert.deepEqual(user.savedJobs.map(String), [String(retained)]);
  assert.deepEqual(user.profile.profilePreferenceFilters.company, ['Shared']);
  assert.deepEqual(user.profile.telegramAlertFilters.company, ['Shared']);
  assert.equal(await Click.countDocuments(), 1);
  assert.equal(await JobAlertDelivery.countDocuments(), 1);
  assert.equal(await AdminAudit.countDocuments(), 1);
  assert.equal(await HiringObservation.countDocuments(), 2, 'shared historical analytics is preserved');
  const runs = await ScraperRun.collection.find().toArray();
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].sources, { other: { success: true, jobsFound: 8 } });
  assert.deepEqual(runs[0].overall, { totalJobs: 8, sourcesSucceeded: 1, sourcesFailed: 0 });
  const reset = await ScraperStatus.findById(scraper._id).lean();
  assert.equal(reset.isActive, false);
  assert.equal(reset.lastJobsFound, 0);
  assert.equal(reset.lastError, null);
  assert.equal(reset.lastRanAt.getTime(), 0);
  assert.equal(await JobDatasetSummary.countDocuments({ companies: 'Selected' }), 0);
  assert.equal(await JobDatasetSummary.countDocuments({ key: 'public-active' }), 1);
  assert.equal((await purgeScraperData(reset)).deletedCount, 0, 'cleanup can be retried');

  await t.test('history recomputation separates skipped and unavailable attempts while retaining partial jobs', async () => {
    const runId = id();
    await ScraperRun.collection.insertOne({ _id: runId, sources: {
      'selected\uFF0Escraper': { success: true, jobsFound: 2 },
      normalizedSkip: { success: false, skipped: true, jobsFound: 0 },
      legacySkip: { success: true, skipped: true, jobsFound: 0 },
      partial: { success: true, partial: true, jobsFound: 5, inserted: 2, updated: 3 },
      blocked: { success: true, jobsFound: 0, zeroJobEvidence: 'blocked-zero' },
      unverified: { success: true, jobsFound: 0, zeroJobEvidence: 'unverified-zero' },
    } });
    await purgeScraperData(reset);
    const run = await ScraperRun.collection.findOne({ _id: runId });
    assert.deepEqual(run.overall, { totalJobs: 5, sourcesSucceeded: 1, sourcesFailed: 2 });
    assert.deepEqual(run.sources.partial, { success: true, partial: true, jobsFound: 5, inserted: 2, updated: 3 });
    assert.equal(run.sources.normalizedSkip.skipped, true);
    assert.equal(run.sources.legacySkip.skipped, true);
    assert.equal(Object.hasOwn(run.sources, 'selected\uFF0Escraper'), false);
  });

  await t.test('purge spans batches and clears references inserted during job deletion', async batch => {
    const jobs = Array.from({ length: 501 }, (_, index) => ({ _id: id(), fingerprint: `batch-${index}`, source: scraper.source, company: 'Selected', status: 'active' }));
    await Job.collection.insertMany(jobs);
    const nativeDelete = Job.deleteMany.bind(Job);
    let insertedLate = false;
    batch.mock.method(Job, 'deleteMany', async filter => {
      const result = await nativeDelete(filter);
      if (!insertedLate) {
        insertedLate = true;
        const lateId = filter._id.$in[0];
        await Click.collection.insertOne({ job: lateId });
        await JobAlertDelivery.collection.insertOne({ job: lateId });
        await User.updateMany({}, { $addToSet: { savedJobs: lateId } });
      }
      return result;
    });
    assert.equal((await purgeScraperData(reset)).deletedCount, 501);
    assert.equal(await Job.countDocuments({ source: scraper.source }), 0);
    assert.equal(await Click.countDocuments({ job: { $in: jobs.map(job => job._id) } }), 0);
    assert.equal(await JobAlertDelivery.countDocuments({ job: { $in: jobs.map(job => job._id) } }), 0);
    assert.deepEqual((await User.findOne().lean()).savedJobs.map(String), [String(retained)]);
  });

  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'scraper-maintenance-test-secret-at-least-32-characters';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  t.mock.method(User, 'findById', userId => ({ select: async () => ({ _id: userId, role: String(userId) === String(admin) ? 'admin' : 'user' }) }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  const { default: routes } = await import('../src/routes/adminRoutes.js');
  const app = express(); app.use(express.json()); app.use('/api/admin', routes);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async ({ user = admin, scraperId = scraper._id, confirmation = scraper.source } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/scraper/${scraperId}/jobs`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ id: String(user) }, process.env.JWT_SECRET)}` } : {}) },
      body: JSON.stringify({ confirmation }),
    });
    return { status: response.status, body: await response.json() };
  };
  await t.test('purge API enforces admin access, valid source IDs, and source confirmation', async () => {
    assert.equal((await request({ user: null })).status, 401);
    assert.equal((await request({ user: id() })).status, 403);
    assert.equal((await request({ scraperId: 'invalid' })).status, 400);
    assert.equal((await request({ scraperId: id() })).status, 404);
    assert.equal((await request({ confirmation: 'other' })).status, 400);
    const pipeline = await ScraperStatus.create({ source: '__pipeline__', lastRanAt: new Date(), lastSuccess: true, pipelineState: 'running' });
    assert.equal((await request({ scraperId: pipeline._id, confirmation: '__pipeline__' })).status, 404);
    assert.equal((await request()).status, 409);
    await ScraperStatus.deleteOne({ _id: pipeline._id });
  });
  await t.test('purge shares the pipeline execution lock and never clears an existing reservation', async () => {
    await PipelineRun.init();
    await PipelineRun.create({ _id: 'existing-run', activeKey: 'database', origin: 'admin', target: 'local', stages: [] });
    assert.equal((await request()).status, 409);
    assert.equal(await PipelineRun.countDocuments({ activeKey: 'database' }), 1);
    await PipelineRun.deleteOne({ _id: 'existing-run' });
  });
  await t.test('purge rejects a direct CLI scraper lease and recovers an interrupted maintenance reservation', async () => {
    const { acquireMongoRunLease } = await import('../scraper-support/utils/runLease.js');
    const lease = await acquireMongoRunLease({ heartbeatIntervalMs: 0 });
    try { assert.equal((await request()).status, 409); }
    finally { await lease.release(); }
    assert.equal(await PipelineRun.countDocuments({ activeKey: 'database' }), 0);
    const stale = new Date(Date.now() - 180000);
    await PipelineRun.create({ _id: 'interrupted-purge', activeKey: 'database', origin: 'admin', target: 'local', localOwner: 'scraper-purge', status: 'running', startedAt: stale, heartbeatAt: stale, stages: [] });
    assert.equal((await request()).status, 200);
    assert.equal((await PipelineRun.findById('interrupted-purge')).status, 'interrupted');
    assert.equal(await PipelineRun.countDocuments({ activeKey: 'database' }), 0);
  });
  await t.test('failed cleanup retains jobs for retry, pauses the source, and releases its execution lock', async failure => {
    await Job.collection.insertOne({ source: scraper.source, company: 'Selected', fingerprint: 'retry-job', status: 'active' });
    await ScraperStatus.updateOne({ _id: scraper._id }, { $set: { isActive: true } });
    failure.mock.method(Click, 'deleteMany', async () => { throw new Error('Test cleanup failure'); });
    assert.equal((await request()).status, 500);
    assert.equal(await Job.countDocuments({ source: scraper.source }), 1);
    assert.equal((await ScraperStatus.findById(scraper._id)).isActive, false);
    assert.equal(await PipelineRun.countDocuments({ activeKey: 'database' }), 0);
  });
  await t.test('confirmed retry finishes cleanup and keeps the scraper configured', async () => {
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.body.data.deletedCount, 1);
    assert.equal(response.body.data.scraper.source, scraper.source);
    assert.equal(response.body.data.scraper.isActive, false);
    assert.equal(await Job.countDocuments({ source: 'other' }), 1);
    assert.equal(await ScraperStatus.countDocuments({ source: scraper.source }), 1);
    assert.equal(await PipelineRun.countDocuments({ activeKey: 'database' }), 0);
  });
  await t.test('retry remembers a batch if dependent cleanup fails after its jobs were deleted', async failure => {
    const lateId = id();
    await Job.collection.insertOne({ _id: lateId, fingerprint: 'post-delete-failure', source: scraper.source, company: 'Selected', status: 'active' });
    const nativeDelete = Click.deleteMany.bind(Click);
    let calls = 0;
    const mock = failure.mock.method(Click, 'deleteMany', async filter => {
      if (++calls === 2) {
        await Click.collection.insertOne({ job: lateId });
        throw new Error('Test post-delete cleanup failure');
      }
      return nativeDelete(filter);
    });
    assert.equal((await request()).status, 500);
    assert.equal(await Job.countDocuments({ _id: lateId }), 0);
    assert.equal(await Click.countDocuments({ job: lateId }), 1);
    mock.mock.restore();
    assert.equal((await request()).status, 200);
    assert.equal(await Click.countDocuments({ job: lateId }), 0, 'retry cleans references after the original jobs are gone');
  });
});
