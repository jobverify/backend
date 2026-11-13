import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { classifyJobsWithBatches } from '../scripts/classifySavedJobs.js';
import { refreshJobBatchEligibility } from '../scripts/lib/batchEligibilityPhase.js';
import { buildJobFilterConditions, jobMatchesSavedFilters } from '../src/services/jobFilterMatcher.js';
import { batchYearExpression } from '../src/utils/jobBatchEligibility.js';
import { batchEligibilityInput, resolveBatchEligibility } from '../src/services/jobBatchEligibility.js';
import { aggregateClassificationSummaries } from '../classification/reporting.js';
import { stageOutcome } from '../src/pipeline/policy.js';
import { buildTelegramMessageBody } from '../src/services/jobAlertService.js';
import { renderBroadcastTemplate } from '../src/services/telegramBroadcastTemplate.js';

process.env.MONGO_URI = 'mongodb://127.0.0.1:1/batch-eligibility-test-guard';
const now = new Date('2026-11-13T00:00:00Z');
const nextYear = new Date('2027-08-01T00:00:00Z');
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Intern', 'Contract', 'Full-time Experienced', 'Full-time Fresher'].map(value => [value, value === label ? .97 : .01])) });
const engineer = { title: 'Engineer', company: 'Batch Test', sourceDescription: 'Minimum 3-5 years of professional experience required. Build production services.',
  sourceUrl: 'https://careers.example.test/role', applyUrl: 'https://careers.example.test/role', country: 'India', city: 'Pune', location: 'Pune, India' };
const ambiguous = 'Applicants need a professional background of between 3 and 5 years.';
const extracted = { status: 'supported', graduationYears: [], graduationMaxYear: null, graduationEvidence: [], experienceRanges: [
  { minimumYears: 3, maximumYears: 5, isOpenEnded: false, alternative: false, evidence: ambiguous },
] };
const notStated = { status: 'not_stated', graduationYears: [], graduationMaxYear: null, graduationEvidence: [], experienceRanges: [] };

test('batch eligibility final phase, caching, concurrency, source persistence and public matching', { timeout: 180000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  await mongoose.connect(mongo.getUri());
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const seed = async (fields = {}) => Job.create({ ...engineer, fingerprint: 'batch-test-' + new mongoose.Types.ObjectId(), status: 'active', ...fields });
  const phase = options => refreshJobBatchEligibility({ now: () => now, mode: 'policy', ...options });

  await t.test('final phase follows worker shutdown, includes cached classifications and leaves inactive jobs alone', async () => {
    await Job.deleteMany({});
    const active = await seed();
    const inactive = await seed({ status: 'expired' });
    let stopped = false;
    const options = { now: () => now, mode: 'policy', worker: { classify: async () => prediction('Full-time Experienced'), stop: async () => { stopped = true; } },
      extractorFactory: () => { assert.equal(stopped, true); assert.fail('deterministic requirements do not need extraction'); } };
    const first = await classifyJobsWithBatches(options);
    assert.equal(stopped, true);
    assert.equal(first.batchEligibility.inferred, 1);
    assert.deepEqual((await Job.findById(active._id).lean()).eligibleBatches, [2022, 2023, 2024]);
    assert.equal((await Job.findById(inactive._id).lean()).batchEligibility, undefined);
    // Simulate deployment to a database whose category is cached but has no batch metadata.
    await Job.updateOne({ _id: active._id }, { $unset: { batchEligibility: '' }, $set: { eligibleBatches: [], eligibleBatchesProvenance: null } });
    const second = await classifyJobsWithBatches({ ...options, worker: { classify: () => assert.fail('category must be cached'), stop: async () => {} } });
    assert.equal(second.cached, 1);
    assert.equal(second.batchEligibility.inferred, 1);
    const rerun = await classifyJobsWithBatches({ ...options, worker: { classify: () => assert.fail('category must remain cached'), stop: async () => {} } });
    assert.equal(rerun.batchEligibility.cached, 1);
    await Job.updateOne({ _id: active._id }, { $set: { eligibleBatches: [1999] } });
    assert.equal((await phase()).inferred, 1);
    assert.deepEqual((await Job.findById(active._id).lean()).eligibleBatches, [2022, 2023, 2024]);
  });

  await t.test('shards cover active jobs exactly once and rollover recalculates without changing categories', async () => {
    await Job.deleteMany({});
    for (let index = 0; index < 7; index++) await seed();
    const parts = await Promise.all([0, 1, 2].map(shard => phase({ shard, shardCount: 3 })));
    assert.equal(parts.reduce((sum, part) => sum + part.inferred, 0), 7);
    assert.equal(await Job.countDocuments({ 'batchEligibility.status': 'inferred' }), 7);
    const january = await phase({ now: () => new Date('2027-01-01T00:00:00Z') });
    assert.equal(january.cached, 7);
    const august = await phase({ now: () => nextYear });
    assert.equal(august.inferred, 7);
    assert.deepEqual((await Job.findOne().lean()).eligibleBatches, [2023, 2024, 2025]);
    assert.equal(await Job.countDocuments({ classification: { $exists: true } }), 0);
  });

  await t.test('the run anchor remains fixed while operational completion timestamps advance across August 1', async () => {
    await Job.deleteMany({});
    const job = await seed({ title: 'Engineering Intern', sourceDescription: 'Currently pursuing a bachelor degree. Build software with the team.' });
    let reads = 0;
    const before = new Date('2027-07-31T18:29:59Z'), after = new Date('2027-07-31T18:30:01Z');
    const result = await classifyJobsWithBatches({ mode: 'policy', now: () => reads++ ? after : before,
      worker: { classify: async () => prediction('Intern'), stop: async () => {} } });
    assert.equal(result.batchEligibility.inferred, 1);
    const stored = await Job.findById(job._id).lean();
    assert.deepEqual(stored.eligibleBatches, [2027]);
    assert.equal(stored.batchEligibility.completedAt.toISOString(), after.toISOString());
  });

  await t.test('source extraction is cached separately from academic rollover and shadow mode only records proposals', async () => {
    await Job.deleteMany({});
    const job = await seed({ sourceDescription: ambiguous });
    const input = batchEligibilityInput(job.toObject(), { now });
    assert.equal(resolveBatchEligibility(input).needsExtraction, true, 'fixture must exercise the extraction path');
    let calls = 0, stopped = 0;
    const extractorFactory = async () => ({ extract: async () => { calls++; return extracted; }, stop: async () => { stopped++; } });
    const shadow = await phase({ mode: 'shadow', extractorFactory });
    assert.equal(shadow.inferred, 1);
    assert.deepEqual((await Job.findById(job._id).lean()).eligibleBatches, []);
    const policy = await phase({ extractorFactory: () => assert.fail('validated shadow extraction should be reused') });
    assert.equal(policy.extractionCached, 1);
    assert.deepEqual((await Job.findById(job._id).lean()).eligibleBatches, [2022, 2023, 2024]);
    const august = await phase({ now: () => nextYear, extractorFactory: () => assert.fail('rollover cannot require another extraction') });
    assert.equal(august.extractionCached, 1);
    assert.deepEqual((await Job.findById(job._id).lean()).eligibleBatches, [2023, 2024, 2025]);
    assert.equal(calls, 1); assert.equal(stopped, 1);
  });

  await t.test('concurrent source changes reject old batches and extraction failures retry without changing classification', async () => {
    await Job.deleteMany({});
    const job = await seed({ sourceDescription: ambiguous });
    const stale = await phase({ extractorFactory: async () => ({ extract: async () => {
      await Job.updateOne({ _id: job._id }, { $set: { sourceDescription: 'Minimum 8 years of professional experience is required.' } });
      return extracted;
    } }) });
    assert.equal(stale.stale, 1);
    assert.deepEqual((await Job.findById(job._id).lean()).eligibleBatches, []);
    assert.equal((await phase()).inferred, 1);
    await Job.updateOne({ _id: job._id }, { $set: { sourceDescription: ambiguous } });
    const failed = await phase({ extractorFactory: async () => { throw new Error('local model unavailable'); } });
    assert.equal(failed.failed, 1);
    assert.equal(stageOutcome('classification', { batchEligibility: failed }), 'failed');
    const retry = await phase({ extractorFactory: async () => ({ extract: async () => notStated }) });
    assert.equal(retry.unknown, 1);
    assert.equal((await Job.findById(job._id).lean()).classification, undefined);
  });

  await t.test('a live batch lease prevents duplicate extraction and expired claims resume', async () => {
    await Job.deleteMany({});
    const job = await seed({ sourceDescription: ambiguous });
    let release, entered;
    const waiting = new Promise(resolve => { release = resolve; });
    const began = new Promise(resolve => { entered = resolve; });
    const first = phase({ extractorFactory: async () => ({ extract: async () => { entered(); await waiting; return extracted; } }) });
    await began;
    const second = await phase({ extractorFactory: () => assert.fail('live lease reached extraction') });
    assert.equal(second.leased, 1);
    release();
    assert.equal((await first).inferred, 1);
    await Job.updateOne({ _id: job._id }, { $set: { 'batchEligibility.status': 'processing', 'batchEligibility.leaseUntil': new Date('2000-01-01') } });
    assert.equal((await phase({ extractorFactory: async () => ({ extract: async () => extracted }) })).inferred, 1);
  });

  await t.test('reporting failure propagates without turning a published result into an extraction failure', async () => {
    await Job.deleteMany({});
    const job = await seed();
    await assert.rejects(() => phase({ onResult: async () => { throw new Error('diagnostics unavailable'); } }), /diagnostics unavailable/);
    const stored = await Job.findById(job._id).lean();
    assert.equal(stored.batchEligibility.status, 'inferred');
    assert.deepEqual(stored.eligibleBatches, [2022, 2023, 2024]);
  });

  await t.test('exact years and open ranges match public filtering, recommendations, saved filters and alert text', async () => {
    await Job.deleteMany({});
    const job = await seed({ sourceDescription: 'At least 3 years of professional experience is required.' });
    await phase();
    assert.equal(await Job.countDocuments(buildJobFilterConditions({ batch: '2023' })), 1);
    assert.equal(await Job.countDocuments(buildJobFilterConditions({ batch: '2025' })), 0);
    const scored = await Job.aggregate([{ $project: { matches: batchYearExpression(2023), excludes: batchYearExpression(2025) } }]);
    assert.equal(scored[0].matches, true); assert.equal(scored[0].excludes, false);
    const stored = await Job.findById(job._id).lean();
    const { normalizeResponseJob } = await import('../src/controllers/jobController.js');
    const publicJob = normalizeResponseJob(stored);
    assert.equal(publicJob.batchEligibility, undefined);
    assert.deepEqual(publicJob.eligibleBatchRange, { maxYear: 2024 });
    for (const [passingYear, expected] of [[2023, true], [2025, false]]) assert.equal(jobMatchesSavedFilters({ job: stored,
      userProfile: { passingYear }, filters: { company: ['Batch Test'] } }), expected);
    assert.match(buildTelegramMessageBody([stored]), /2024 and earlier \(estimated\)/);
    assert.match(renderBroadcastTemplate('{batch}\n{jobUrl}', stored), /2024 and earlier \(estimated\)/);
    const summary = aggregateClassificationSummaries([{ batchEligibility: { inferred: 1, pending: 2, failed: 0 } }]);
    assert.equal(summary.batchEligibility.inferred, 1); assert.equal(summary.batchEligibility.pending, 2);
    assert.equal(stageOutcome('classification', summary), 'incomplete');
    assert.equal(stageOutcome('classification', { ...summary, failed: 1 }), 'failed');
  });

  await t.test('real re-scrapes retain unchanged inferred batches and clear them when employer requirements change', async () => {
    await Job.deleteMany({});
    const { saveToDB } = await import('../scraper-support/utils/saveToDB.js');
    const source = 'batch-rescrape-test';
    const native = { ...engineer, description: engineer.sourceDescription, source, jobId: 'test-role', requisitionId: 'test-role',
      sourceDetailComplete: true, sourceListingComplete: false };
    const options = { now, enrichPublicExperience: false, descriptionRewriteMode: 'off', enqueueAlerts: false,
      refreshDatasetSummary: false, replaceExisting: false };
    await saveToDB([native], source, options);
    await phase();
    let stored = await Job.findOne({ source }).lean();
    assert.deepEqual(stored.eligibleBatches, [2022, 2023, 2024]);
    await saveToDB([native], source, options);
    stored = await Job.findOne({ source }).lean();
    assert.deepEqual(stored.eligibleBatches, [2022, 2023, 2024]);
    assert.equal(stored.batchEligibility.status, 'inferred');
    await saveToDB([{ ...native, sourceDescription: 'Minimum 8 years of professional experience is required.',
      description: 'Minimum 8 years of professional experience is required.' }], source, options);
    stored = await Job.findOne({ source }).lean();
    assert.deepEqual(stored.eligibleBatches, []);
    assert.equal(stored.batchEligibility.status, 'pending');
  });
});
