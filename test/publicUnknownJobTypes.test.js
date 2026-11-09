import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PUBLIC_JOB_TYPES, normalizePublicJobType } from '../src/utils/publicJobTypeLabel.js';
import { PREFERRED_JOB_TYPES, getPreferredJobTypeMatches } from '../src/constants/preferredJobTypes.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
import { getJobMeta, normalizeJobListResponseJob } from '../src/controllers/jobController.js';
import { resolveClassification } from '../src/services/jobClassificationPolicy.js';
import { buildJobFilterConditions, jobMatchesSavedFilters } from '../src/services/jobFilterMatcher.js';
import Job from '../src/models/Job.js';
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js';

const now = new Date('2026-10-30T08:00:00Z');
const unknownClassification = () => resolveClassification({ title: 'Engineer', description: 'Build and maintain software tools.' }, null, { now, mode: 'policy' });

test('unknown types remain internal queue states without becoming public choices', () => {
  for (const input of [null, undefined, '', 'Not specified', 'Unspecified', 'Others', 'part-time', 'unexpected']) {
    assert.equal(normalizePublicJobType(input), 'Unspecified', String(input));
  }
  for (const [input, expected] of [['Internship', 'Intern'], ['Intern', 'Intern'], ['Full-time Fresher', 'Full-time Fresher'], ['Full-time Experienced', 'Full-time Experienced'], ['Contract', 'Contract']]) {
    assert.equal(normalizePublicJobType(input), expected);
  }
  assert.deepEqual(PREFERRED_JOB_TYPES, ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract']);
  assert.equal(PUBLIC_JOB_TYPES.includes('Unspecified'), false);
  assert.deepEqual(getPreferredJobTypeMatches('Unspecified'), []);
});

test('unknown source eligibility survives scraping and API normalization', () => {
  for (const job of [
    { title: 'Engineer', jobType: 'Unspecified', classification: unknownClassification() },
    { title: 'Engineer', jobType: 'Full-time Experienced', classification: unknownClassification() },
    { title: 'Engineer', description: 'Build and maintain software tools.' },
  ]) {
    assert.equal(normalizeScrapedJob(job).jobType, 'Unspecified');
    assert.equal(normalizeJobListResponseJob(job).jobType, 'Unspecified');
  }
});

test('saved fresher and experienced preferences do not match unresolved authoritative eligibility', () => {
  const job = { title: 'Engineer', jobType: 'Full-time Experienced', classification: unknownClassification() };
  assert.equal(jobMatchesSavedFilters({ job, filters: { jobType: ['Full-time Experienced'] } }), false);
  assert.equal(jobMatchesSavedFilters({ job, filters: { jobType: ['Full-time Fresher'] } }), false);
});

test('saved category filters agree with public response categories for legacy and classified rows', () => {
  for (const job of [
    { title: 'Engineer', jobType: null, employmentType: 'Full-time' },
    { title: 'Engineer', jobType: 'Others' },
    { title: 'Graduate Engineer', jobType: 'Full-time', experienceRequired: 'Freshers can apply' },
    { title: 'Engineer', jobType: 'Full-time Fresher', experienceRequired: 'Minimum 5 years of experience' },
    { title: 'Engineer', jobType: 'Full-time Experienced', classification: unknownClassification() },
  ]) {
    job.sourceDescription = 'Build and maintain engineering software services for our customers.';
    const expected = normalizeJobListResponseJob(job).jobType;
    for (const category of PUBLIC_JOB_TYPES) {
      assert.equal(jobMatchesSavedFilters({ job, filters: { jobType: [category] } }), category === expected,
        `${JSON.stringify(job)} selecting ${category}; public category ${expected}`);
    }
  }
});

test('Mongo public categories match the API and unknown jobs stay out of early-career scope', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const collection = mongoose.connection.collection('unknown_public_categories');
  const cases = [
    { title: 'Engineer', jobType: 'Full-time Experienced', classification: unknownClassification(), expected: 'Unspecified' },
    { title: 'Engineer', jobType: 'Unspecified', employmentType: 'Full-time', experienceLevel: 'Mid Level', expected: 'Unspecified' },
    { title: 'Engineer', expected: 'Unspecified' },
    { title: 'Engineer', jobType: 'Full-time Fresher', expected: 'Full-time Fresher' },
    { title: 'Intern', jobType: 'Internship', expected: 'Intern' },
    { title: 'Engineer', jobType: 'Contract', expected: 'Contract' },
    { title: 'Engineer', jobType: 'Full-time Experienced', expected: 'Full-time Experienced' },
    { title: 'Senior Engineer', experienceLevel: 'Unrecognized', expected: 'Unspecified' },
    { title: 'Junior Engineer', jobType: 'Full-time Experienced', experienceLevel: 'Unknown', expected: 'Unspecified' },
    { title: 'Engineer II', experienceLevel: 'Not specified', expected: 'Unspecified' },
  ].map((job, index) => ({ ...job, marker: index, status: 'active', isPublicIndia: true, postedAt: now, closingDate: null,
    sourceDescription: 'Build and maintain engineering software services for our customers.' }));
  await collection.insertMany(cases);
  const categories = await collection.aggregate([{ $project: { marker: 1, category: PUBLIC_JOB_TYPE_EXPRESSION } }]).toArray();
  assert.deepEqual(categories.map(row => row.category), ['Unspecified', 'Unspecified', 'Unspecified', 'Full-time Fresher', 'Intern', 'Contract', 'Full-time Experienced', 'Unspecified', 'Unspecified', 'Unspecified']);
  for (const job of cases) assert.equal(normalizeJobListResponseJob(job).jobType, job.expected);
  const all = await collection.find(applyPublicJobVisibility({ status: 'active' }, { experiencedJobsEnabled: true }, now)).toArray();
  assert.equal(all.length, 4);
  const experienced = await collection.find(applyPublicJobVisibility({ status: 'active', jobType: 'Full-time Experienced' }, { experiencedJobsEnabled: true }, now)).toArray();
  assert.deepEqual(experienced.map(row => row.marker), [6]);
  const unspecified = await collection.find(applyPublicJobVisibility(buildJobFilterConditions({ jobType: 'Unspecified' }), { experiencedJobsEnabled: true }, now)).toArray();
  assert.deepEqual(unspecified.map(row => row.marker), []);
  const early = await collection.find(applyPublicJobVisibility({ status: 'active' }, { experiencedJobsEnabled: false }, now)).toArray();
  assert.deepEqual(early.map(row => row.expected), ['Full-time Fresher', 'Intern', 'Contract']);
  await Job.collection.insertMany([cases[0], cases[4]].map((job, index) => ({ ...job,
    fingerprint: `effective-summary-${index}`, company: 'Summary Test', postedAt: new Date() })));
  const summary = await refreshJobDatasetSummary();
  assert.equal(summary.totalJobs, 1);
  assert.deepEqual(summary.jobTypes, ['Intern']);
});

test('company-scoped metadata uses authoritative public types before stored labels are repaired', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Job.collection.insertOne({ title: 'Engineer', company: 'Scoped Unknown', companyKey: 'scoped unknown',
    fingerprint: 'scoped-unknown', status: 'active', isPublicIndia: true, city: 'Bangalore', country: 'India', postedAt: new Date(),
    sourceDescription: 'Build and maintain software services for the engineering team.',
    jobType: 'Full-time Experienced', classification: unknownClassification() });
  const res = { set() { return this; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await getJobMeta({ query: { company: 'Scoped Unknown' }, siteSettings: { billingEnabled: false, experiencedJobsEnabled: true } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.jobTypes, []);
});
