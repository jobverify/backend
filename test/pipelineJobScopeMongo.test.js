import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import PipelineConfiguration from '../src/models/PipelineConfiguration.js';
import PipelineRun from '../src/models/PipelineRun.js';
import { defaultConfiguration } from '../src/pipeline/policy.js';
import { createPipeline, failPipeline } from '../src/pipeline/execution.js';
import { savedPipelineConfiguration } from '../src/pipeline/configuration.js';
import { loadPipelineJobFilter } from '../src/pipeline/jobScope.js';
import { classifyJobsWithBatches } from '../scripts/classifySavedJobs.js';
import { assignedSavedJobs } from '../scripts/lib/assignedSavedJobs.js';
import { rewriteQueueQuery, rewriteQueuePages } from '../rewriting/runner.js';

test('saved scope snapshots select new inserts consistently for rewrite, classification and batches', { timeout: 180000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const config = defaultConfiguration();
  config.stages.find(s => s.key === 'rewrite').runForAllExistingJobs = true;
  await PipelineConfiguration.create({ _id: 'global', ...config });
  const saved = await savedPipelineConfiguration();
  assert.equal(saved.stages[1].runForAllExistingJobs, true);
  assert.equal(saved.stages[2].runForAllExistingJobs, false);
  const run = await createPipeline({ configuration: saved, origin: 'admin', target: 'local' });
  const start = new Date('2026-11-16T10:00:00Z'), end = new Date('2026-11-16T11:00:00Z');
  await PipelineRun.updateOne({ _id: run._id }, { $set: {
    'stages.0.status': 'completed', 'stages.0.startedAt': start, 'stages.0.completedAt': end,
  } });
  await PipelineConfiguration.updateOne({ _id: 'global' }, { $set: { 'stages.1.runForAllExistingJobs': false, 'stages.2.runForAllExistingJobs': true } });
  const rewriteFilter = await loadPipelineJobFilter('rewrite', { pipelineId: run._id });
  const newFilter = await loadPipelineJobFilter('classification', { pipelineId: run._id });
  assert.deepEqual(rewriteFilter, {});
  assert.deepEqual(newFilter, { firstSeenPipelineId: run._id });

  const seed = async (label, createdAt, status = 'active', firstSeenPipelineId) => Job.create({
    title: 'Engineer', company: 'Scope Test', fingerprint: label, status, createdAt,
    updatedAt: end, lastSeenAt: end, scrapedAt: end, firstSeenPipelineId,
    sourceDescription: 'Minimum 3-5 years of professional experience required. Build production services.',
    description: 'Minimum 3-5 years of professional experience required. Build production services.',
    sourceUrl: `https://careers.example.test/${label}`, applyUrl: `https://careers.example.test/${label}`,
    country: 'India', city: 'Pune', location: 'Pune, India', sourceContentHash: 'scope-source-hash',
    descriptionRewrite: { status: 'pending', attempts: 0, queuedAt: start },
  });
  const old = await seed('old-rescraped', new Date(start.getTime() - 1));
  const first = await seed('new-at-start', start, 'active', run._id);
  const last = await seed('new-at-end', end, 'active', run._id);
  await seed('unrelated-concurrent-scrape', start, 'active', 'other-pipeline');
  await seed('inactive-new', start, 'expired', run._id);
  const ids = docs => docs.map(j => String(j._id)).sort();
  const newIds = ids([first, last]);
  const rewritten = [];
  for await (const job of rewriteQueuePages(Job, rewriteQueueQuery(end, { jobFilter: newFilter }))) rewritten.push(job);
  assert.deepEqual(ids(rewritten), newIds);
  assert.equal(await Job.countDocuments(rewriteQueueQuery(end, { jobFilter: rewriteFilter })), 4);
  assert.equal(await Job.countDocuments(rewriteQueueQuery(end, { jobFilter: { _id: { $in: [] } } })), 0);
  const shards = [];
  for (let shard = 0; shard < 3; shard++) {
    for await (const job of assignedSavedJobs(Job, shard, 3, { scanned: 0 }, () => false, newFilter)) shards.push(job);
  }
  assert.deepEqual(ids(shards), newIds);
  const worker = { classify: async () => ({ modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
    scores: { Intern: .01, Contract: .01, 'Full-time Experienced': .97, 'Full-time Fresher': .01 } }), stop: async () => {} };
  const summary = await classifyJobsWithBatches({ worker, mode: 'policy', now: () => end, jobFilter: newFilter,
    extractorFactory: () => assert.fail('Explicit experience does not require extraction') });
  assert.equal(summary.assigned, 2);
  assert.equal(summary.batchEligibility.assigned, 2);
  assert.equal(summary.batchEligibility.inferred, 2);
  assert.deepEqual((await Job.findById(first._id).lean()).eligibleBatches, [2022, 2023, 2024]);
  assert.equal((await Job.findById(old._id).lean()).batchEligibility, undefined);
  const all = await classifyJobsWithBatches({ worker, mode: 'policy', now: () => end, jobFilter: rewriteFilter,
    extractorFactory: () => assert.fail('Explicit experience does not require extraction') });
  assert.equal(all.assigned, 4);
  assert.equal(all.batchEligibility.assigned, 4);
  assert.deepEqual((await Job.findById(old._id).lean()).eligibleBatches, [2022, 2023, 2024]);
  await t.test('real scraper inserts record ownership and rescrapes never transfer it', async () => {
    const { saveToDB } = await import('../scraper-support/utils/saveToDB.js');
    const previousId = process.env.PIPELINE_ID;
    t.after(() => { if (previousId === undefined) delete process.env.PIPELINE_ID; else process.env.PIPELINE_ID = previousId; });
    const source = 'pipeline-scope-save-test';
    const native = jobId => ({ title: 'Engineer', company: 'Scope Test', source, jobId, requisitionId: jobId,
      description: 'Minimum 3-5 years of professional experience required. Build production services.',
      sourceDescription: 'Minimum 3-5 years of professional experience required. Build production services.',
      sourceUrl: `https://careers.example.test/${jobId}`, applyUrl: `https://careers.example.test/${jobId}`,
      country: 'India', city: 'Pune', location: 'Pune, India', sourceDetailComplete: true, sourceListingComplete: false,
    });
    const options = { now: end, enrichPublicExperience: false, descriptionRewriteMode: 'off', enqueueAlerts: false,
      refreshDatasetSummary: false, replaceExisting: false };
    delete process.env.PIPELINE_ID;
    await saveToDB([native('existing')], source, options);
    process.env.PIPELINE_ID = run._id;
    await saveToDB([native('existing'), native('new')], source, options);
    const existing = await Job.findOne({ source, jobId: 'existing' }).select('+firstSeenPipelineId').lean();
    const inserted = await Job.findOne({ source, jobId: 'new' }).select('+firstSeenPipelineId').lean();
    assert.equal(existing.firstSeenPipelineId, undefined);
    assert.equal(inserted.firstSeenPipelineId, run._id);
    assert.equal(Object.hasOwn(await Job.findById(inserted._id).lean(), 'firstSeenPipelineId'), false);
    const { normalizeResponseJob } = await import('../src/controllers/jobController.js');
    assert.equal(Object.hasOwn(normalizeResponseJob(inserted), 'firstSeenPipelineId'), false);
    process.env.PIPELINE_ID = 'later-pipeline';
    await saveToDB([native('new')], source, options);
    assert.equal((await Job.findById(inserted._id).select('+firstSeenPipelineId').lean()).firstSeenPipelineId, run._id);
    assert.deepEqual(ids(await Job.find({ source, ...newFilter }).lean()), [String(inserted._id)]);
  });
  await failPipeline(run._id, 'cancelled', 'Test finished');
});
