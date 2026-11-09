import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
import { normalizeJobListResponseJob } from '../src/controllers/jobController.js';
import { resolveClassification } from '../src/services/jobClassificationPolicy.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';
import { readHiringSnapshot } from '../src/services/hiringObservationService.js';

const allowed = ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract'];
const now = new Date('2026-10-19T08:00:00Z');
const cases = [
  ...[null, '', 'Not specified', 'Unspecified', 'Others', 'part-time', 'unexpected'].map(jobType => ({ title: 'Part-time Assistant', jobType })),
  ...allowed.map(jobType => ({ title: 'Engineer', jobType })),
  { title: 'Engineer', classification: resolveClassification({ title: 'Engineer', description: 'Build software.' }, null, { now, mode: 'policy' }) },
];

test('inventory retains unresolved input while public categories contain only four types', () => {
  for (const job of cases) {
    const expected = allowed.includes(job.jobType) ? job.jobType : 'Unspecified';
    assert.equal(normalizeScrapedJob(job).jobType, expected, JSON.stringify(job));
    assert.equal(normalizeJobListResponseJob(job).jobType, expected, JSON.stringify(job));
  }
});

test('Mongo categorization and live analytics normalize legacy types without losing jobs', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Job.collection.insertMany(cases.map((job, index) => ({ ...job, fingerprint: `four-${index}`, company: 'Test', status: 'active', isPublicIndia: true, description: 'Build software.' })));
  const rows = await Job.aggregate([{ $project: { jobType: 1, classification: 1, title: 1, category: PUBLIC_JOB_TYPE_EXPRESSION } }]);
  for (const row of rows) {
    assert.ok([...allowed, 'Unspecified'].includes(row.category), String(row.category));
    assert.equal(row.category, normalizeJobListResponseJob(row).jobType);
  }
  const summary = await readHiringSnapshot({ experiencedJobsEnabled: true }, now);
  assert.equal(summary.totalJobs, allowed.length);
  assert.equal(summary.jobTypes.reduce((sum, row) => sum + row.count, 0), allowed.length);
  assert.deepEqual(summary.jobTypes.map(row => row.label).sort(), [...allowed].sort());
  const early = await readHiringSnapshot({ experiencedJobsEnabled: false }, now);
  assert.ok(early.jobTypes.every(row => row.label !== 'Full-time Experienced'));
});
