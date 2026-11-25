import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { batchEligibilityInput } from '../src/services/jobBatchEligibility.js';
import { batchHash } from '../src/utils/jobBatchEligibility.js';
import { refreshJobBatchEligibility } from '../scripts/lib/batchEligibilityPhase.js';

test('the graduation policy upgrade refreshes previously cached abstentions', { timeout: 60000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const saved = await Job.create({ title: 'Analyst', company: 'Policy Upgrade Test', status: 'active',
    fingerprint: 'graduation-policy-upgrade',
    sourceDescription: 'Preferred work mode: Office\nOnly the 2024 graduation batch is eligible.' });
  const job = await Job.findById(saved._id).lean();
  const now = new Date('2026-11-24T00:00:00Z');
  const result = { eligibleBatches: [], eligibleBatchRange: null, eligibleBatchesProvenance: null };
  // Recreate the old cache's identity with the old version, independent of
  // the version used by the upgraded resolver.
  const input = batchEligibilityInput(job, { now });
  const inputHash = batchHash({ sourceHash: input.sourceHash, jobType: input.jobType, profile: input.profile,
    anchorYear: input.anchorYear, nativeYears: input.nativeYears, nativeMaximum: input.nativeMaximum,
    version: 'academic-batches-v2' });
  await Job.updateOne({ _id: saved._id }, { $set: { ...result,
    batchEligibility: { inputHash, version: 'academic-batches-v2', mode: 'policy', status: 'unknown',
      basis: 'not_stated', result } } });
  const options = { mode: 'policy', now: () => now,
    extractorFactory: () => assert.fail('an explicit cohort does not need model inference') };
  const refreshed = await refreshJobBatchEligibility(options);
  assert.equal(refreshed.cached, 0);
  assert.equal(refreshed.explicit, 1);
  assert.deepEqual((await Job.findById(saved._id).lean()).eligibleBatches, [2024]);
  const repeated = await refreshJobBatchEligibility(options);
  assert.equal(repeated.cached, 1);
});
