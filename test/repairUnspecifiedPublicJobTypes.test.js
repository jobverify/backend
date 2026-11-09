import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import * as classification from '../src/services/postScrapeClassification.js';
import { hashClassificationInput } from '../src/services/jobClassificationPolicy.js';

const now = new Date('2026-10-30T08:00:00Z');
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } };
const sourceJob = () => ({ title: 'Engineer', company: 'Repair Test', fingerprint: 'repair-unknown', source: 'repair-test',
  status: 'active', sourceDescription: 'Build and maintain tools for the engineering team.', sourceEmploymentType: 'Full-time',
  eligibleBatches: [], eligibleBatchesProvenance: 'source', jobType: 'Full-time Experienced' });
const cachedJob = () => {
  const job = sourceJob();
  const result = classification.resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' });
  // A legacy runtime identity can be checked without trusting today's runtime hash.
  const oldInput = { ...classification.postScrapeInput(job, { now }), runtimeHash: 'previous-public-label-runtime' };
  const inputHash = hashClassificationInput(oldInput);
  const saved = { ...result, resolved: { ...result.resolved, jobType: 'Unspecified' }, inputHash, runtimeHash: oldInput.runtimeHash };
  return { ...job, _id: new mongoose.Types.ObjectId(), classification: saved,
    postClassification: { status: 'completed', mode: 'policy', inputHash,
      result: { classification: saved, prediction } } };
};

test('repair CLI rejects empty or repeated source scope before connecting to a database', async () => {
  const { parseRepairArguments } = await import('../scripts/repairUnspecifiedPublicJobTypes.js');
  assert.equal(typeof parseRepairArguments, 'function');
  assert.deepEqual(parseRepairArguments([]), { apply: false, source: null });
  assert.deepEqual(parseRepairArguments(['--apply', '--source=efftronics']), { apply: true, source: 'efftronics' });
  for (const args of [['--apply', '--source='], ['--source=  '], ['--source=a', '--source=b'], ['--unknown']]) {
    assert.throws(() => parseRepairArguments(args));
  }
});

test('repair updates only a legacy public label whose complete authoritative source still matches', () => {
  const job = cachedJob();
  const operation = classification.buildUnspecifiedPublicTypeRepair?.(job);
  assert.equal(operation?.update.$set.jobType, 'Full-time Experienced');
  assert.equal(operation?.update.$set.classification.resolved.jobType, 'Full-time Experienced');
  assert.equal(operation.filter._id, job._id);
  assert.equal(operation.filter.jobType, 'Full-time Experienced');
  assert.equal(operation.filter['classification.inputHash'], job.classification.inputHash);
  assert.equal(operation.filter['postClassification.status'], 'completed');
  assert.ok(operation.filter.$and.some(guard => guard.sourceDescription?.$eq === job.sourceDescription));
});

test('repair rejects changed input, stale policy, shadow results, mismatched caches and active work', () => {
  for (const change of [
    job => { job.sourceDescription += ' Minimum 5 years of professional experience required.'; },
    job => { job.eligibleBatches = [2025]; },
    job => { job.classification.policyVersion = 'obsolete'; },
    job => { job.classification.authoritative = false; },
    job => { job.classification.complete = false; },
    job => { job.classification.mode = 'shadow'; },
    job => { job.postClassification.mode = 'shadow'; },
    job => { job.postClassification.status = 'processing'; },
    job => { job.postClassification.result.classification = { ...job.classification, resolved: { ...job.classification.resolved, jobType: 'Full-time Fresher' } }; },
    job => { job.postClassification.result.prediction = { ...prediction, fullDescriptionCovered: false }; },
  ]) {
    const job = structuredClone(cachedJob());
    change(job);
    assert.equal(classification.buildUnspecifiedPublicTypeRepair?.(job), null);
  }
});

test('backfill previews, applies, refreshes once, is idempotent and protects concurrent source edits', async t => {
  const module = await import('../scripts/repairUnspecifiedPublicJobTypes.js').catch(error => {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url?.endsWith('/scripts/repairUnspecifiedPublicJobTypes.js')) {
      assert.fail('The dry-run-first classification-label backfill is not implemented');
    }
    throw error;
  });
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const first = cachedJob();
  const concurrent = { ...cachedJob(), fingerprint: 'repair-concurrent' };
  const changed = { ...cachedJob(), fingerprint: 'repair-changed', sourceDescription: 'A different employer description.' };
  await Job.collection.insertMany([first, concurrent, changed]);
  let refreshed = 0;
  const refreshSummary = async () => { refreshed++; };
  const preview = await module.repairUnspecifiedPublicJobTypes({ refreshSummary });
  assert.equal(preview.eligible, 2);
  assert.equal(preview.updated, 0);
  assert.equal(refreshed, 0);
  assert.equal((await Job.findById(first._id).lean()).jobType, 'Full-time Experienced');
  const originalUpdate = Job.updateOne.bind(Job);
  let raced = false;
  t.mock.method(Job, 'updateOne', (filter, update) => {
    if (String(filter._id) === String(concurrent._id) && !raced) {
      raced = true;
      return originalUpdate({ _id: concurrent._id }, { $set: { sourceDescription: 'Changed immediately before the repair.' } })
        .then(() => originalUpdate(filter, update));
    }
    return originalUpdate(filter, update);
  });
  const applied = await module.repairUnspecifiedPublicJobTypes({ apply: true, refreshSummary });
  assert.equal(applied.updated, 1);
  assert.equal(applied.stale, 1);
  assert.equal(refreshed, 1);
  const repaired = await Job.findById(first._id).lean();
  assert.equal(repaired.jobType, 'Full-time Experienced');
  assert.equal(repaired.classification.resolved.jobType, 'Full-time Experienced');
  assert.equal(repaired.classification.inputHash, repaired.postClassification.inputHash);
  assert.equal(repaired.postClassification.status, 'completed');
  assert.equal((await Job.findById(concurrent._id).lean()).jobType, 'Full-time Experienced');
  assert.equal((await Job.findById(changed._id).lean()).jobType, 'Full-time Experienced');
  const again = await module.repairUnspecifiedPublicJobTypes({ apply: true, refreshSummary });
  assert.equal(again.updated, 0);
  assert.equal(refreshed, 1);
});
