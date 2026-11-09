import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js';
import { getAuthoritativeClassification } from '../src/services/jobClassificationPolicy.js';
import { normalizePublicJobCategory } from '../src/utils/publicJobNormalization.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';
import { PUBLIC_JOB_TYPES } from '../src/utils/publicJobTypeLabel.js';
import { readHiringSnapshot } from '../src/services/hiringObservationService.js';
import Job from '../src/models/Job.js';

const types = ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract'];
const now = new Date('2026-10-30T08:00:00Z');
const source = { title: 'Engineer', sourceDescription: 'Build and maintain software tools for our customers.' };
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(types.map(type => [type, type === label ? .97 : .01])) });
const classify = (label, job = source) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' });
const legacy = label => {
  const result = classify(label);
  return { ...result, resolved: { ...result.resolved, jobType: 'Unspecified' } };
};

test('unresolved source eligibility uses each model category without inventing numeric experience', () => {
  assert.deepEqual(PUBLIC_JOB_TYPES, types);
  for (const type of types) {
    const result = classify(type);
    assert.equal(result.resolved.jobType, type);
    assert.equal(result.decisionSource, 'model_fallback');
    assert.equal(result.comparison.logicJobType, 'Unspecified');
    assert.deepEqual(result.resolved.experienceYears, []);
    assert.equal(result.resolved.experienceProfile.minimumYears, null);
  }
});

test('explicit source eligibility still overrides model predictions', () => {
  assert.equal(classify('Full-time Fresher', { ...source, sourceDescription: 'Minimum 5 years of professional experience required.' }).resolved.jobType, 'Full-time Experienced');
  assert.equal(classify('Contract', { title: 'Software Intern', sourceDescription: 'Join our engineering internship.' }).resolved.jobType, 'Intern');
});

test('complete saved authoritative model decisions resolve legacy unknown categories', () => {
  for (const type of types) {
    const job = { ...source, jobType: 'Unspecified', classification: legacy(type) };
    assert.equal(getAuthoritativeClassification(job).jobType, type);
    assert.equal(normalizePublicJobCategory(job), type);
  }
  for (const patch of [{ complete: false }, { mode: 'shadow' }, { authoritative: false },
    { policyVersion: 'obsolete' }, { sourceQualityIssues: ['insufficient_role_description'] },
    { decisions: { jobType: { label: 'Unspecified' } } }]) {
    const job = { ...source, jobType: 'Unspecified', classification: { ...legacy('Intern'), ...patch } };
    assert.equal(normalizePublicJobCategory(job), 'Unspecified');
  }
});

test('Mongo, listings and snapshot totals use model categories and exclude jobs awaiting classification', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const rows = [...types.map(type => ({ classification: legacy(type), expected: type })),
    { expected: null }, { classification: { ...legacy('Intern'), complete: false }, expected: null },
    { classification: { ...legacy('Contract'), mode: 'shadow' }, expected: null }]
    .map((row, marker) => ({ ...source, ...row, marker, fingerprint: `model-public-${marker}`, company: 'Model Test',
      jobType: 'Unspecified', status: 'active', isPublicIndia: true, postedAt: now, closingDate: null }));
  await Job.collection.insertMany(rows);
  const categories = await Job.aggregate([{ $project: { marker: 1, category: PUBLIC_JOB_TYPE_EXPRESSION } }]);
  assert.deepEqual(categories.map(row => row.category), rows.map(row => row.expected ?? 'Unspecified'));
  const visible = await Job.find(applyPublicJobVisibility({ status: 'active' }, {}, now)).lean();
  assert.equal(visible.length, 4);
  for (const job of visible) assert.equal(normalizePublicJobCategory(job), job.expected);
  const snapshot = await readHiringSnapshot({}, now);
  assert.equal(snapshot.totalJobs, 4);
  assert.equal(snapshot.jobTypes.reduce((sum, row) => sum + row.count, 0), 4);
  assert.deepEqual(snapshot.jobTypes.map(row => row.label).sort(), [...types].sort());
  const early = await readHiringSnapshot({ experiencedJobsEnabled: false }, now);
  assert.equal(early.totalJobs, 3);
});
