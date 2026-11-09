import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/employer-date-test-guard';
process.env.JWT_SECRET ||= 'employer-date-local-tests-only';
process.env.POST_SCRAPE_CLASSIFICATION_MODE = 'shadow';
const { saveToDB } = await import('../scraper-support/utils/saveToDB.js');
const { normalizeScrapedJob } = await import('../scraper-support/utils/normalizeScrapedJob.js');
const { getPublishingBuildFeed } = await import('../src/controllers/publishingController.js');

test('employer date evidence survives repeated normalization, MongoDB and the public build feed', { timeout: 180000 }, async t => {
  const mongo = new MongoMemoryServer({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongo.start();
  await mongoose.connect(mongo.getUri());
  const source = 'local-employer-date-proof';
  const native = {
    source, jobId: 'verified-role', requisitionId: 'verified-role', title: 'Software Engineer', company: 'Evidence Test Company',
    city: 'Pune', location: 'Pune, India', country: 'India',
    sourceUrl: 'https://careers.example.test/verified-role', applyUrl: 'https://careers.example.test/verified-role',
    description: 'Full-time position. No prior work experience is required. Fresh graduates are welcome. Build reliable software services, test accessibility and collaborate with the engineering team.',
    postingDate: '2026-11-05', postedAt: '2026-11-05', sourceDateProvenance: 'workday-cxs-jobPostingInfo',
    sourceRawDates: { startDate: '2026-11-05', endDate: null }, postingDatePrecision: 'calendar-date',
    sourcePostingDateIsExact: false, sourceDetailComplete: true, sourceListingComplete: false,
  };
  const options = { now: new Date('2026-11-08T12:00:00Z'), enrichPublicExperience: false,
    descriptionRewriteMode: 'off', enqueueAlerts: false, refreshDatasetSummary: false, replaceExisting: false };
  const normalizeTwice = job => normalizeScrapedJob(JSON.parse(JSON.stringify(normalizeScrapedJob(job))));
  const find = jobId => Job.findOne({ source, requisitionId: jobId }).lean();

  await saveToDB([normalizeTwice(native)], source, options);
  const stored = await find(native.jobId);
  assert.ok(stored, 'fixture must pass through the real persistence path');
  assert.equal(stored.employerPostedAt?.toISOString(), '2026-11-05T00:00:00.000Z');
  const res = { statusCode: 200, set() { return this; }, status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; } };
  await getPublishingBuildFeed({ query: {} }, res, error => { throw error; });
  assert.equal(res.statusCode, 200);
  const published = res.body.data.jobs.find(job => String(job._id) === String(stored._id));
  assert.ok(published, 'verified fixture must be publicly visible');
  assert.equal(new Date(published.employerPostedAt).toISOString(), '2026-11-05T00:00:00.000Z');

  const conflict = { ...native, jobId: 'conflicting-role', requisitionId: 'conflicting-role',
    sourceUrl: 'https://careers.example.test/conflicting-role', applyUrl: 'https://careers.example.test/conflicting-role',
    postedAt: '2026-11-06' };
  const rejected = normalizeTwice(conflict);
  assert.equal(rejected.employerPostedAt, null, 'normalization must not restore rejected evidence');
  await saveToDB([rejected], source, options);
  assert.equal((await find(conflict.jobId)).employerPostedAt, null);

  await saveToDB([{ ...native, description: null, sourceDetailComplete: false, preserveExistingSourceContent: true }], source, options);
  assert.equal((await find(native.jobId)).employerPostedAt?.toISOString(), '2026-11-05T00:00:00.000Z',
    'a partial detail outage must retain previously verified evidence');

  const unverified = { ...native, sourceDateProvenance: undefined, sourceRawDates: undefined };
  await saveToDB([unverified], source, options);
  assert.equal((await find(native.jobId)).employerPostedAt, null, 'a fresh unverified update cannot retain an employer-date claim');
});
