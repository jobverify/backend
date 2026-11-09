import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
import { normalizeJobListResponseJob, getJobMeta } from '../src/controllers/jobController.js';
import { buildJobFilterConditions, jobMatchesSavedFilters } from '../src/services/jobFilterMatcher.js';
import { readHiringSnapshot } from '../src/services/hiringObservationService.js';

const cases = [undefined, null, '', 'Not specified', 'Flexible', 'unexpected', 'On-site', 'Remote', 'Hybrid'];
test('missing and unsupported work arrangements default to On-site in scraped and public jobs', () => {
  for (const workArrangement of cases) {
    const job = { title: 'Engineer', description: 'Develop software.', workArrangement };
    const expected = ['Remote', 'Hybrid'].includes(workArrangement) ? workArrangement : 'On-site';
    assert.equal(normalizeScrapedJob(job).workArrangement, expected);
    assert.equal(normalizeJobListResponseJob(job).workArrangement, expected);
  }
});

test('legacy work arrangements agree across analytics, Mongo filtering, and saved filters', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Job.collection.insertMany(cases.map((workArrangement, index) => ({
    fingerprint: `arrangement-${index}`, title: 'Engineer', description: 'Develop software.',
    company: 'Test', companyKey: 'test', city: 'Bangalore', country: 'India',
    jobType: 'Full-time Experienced', status: 'active', isPublicIndia: true,
    ...(workArrangement === undefined ? {} : { workArrangement }),
  })));
  const summary = await readHiringSnapshot({ experiencedJobsEnabled: true });
  assert.deepEqual(summary.arrangements, [
    { label: 'On-site', count: 7 }, { label: 'Hybrid', count: 1 }, { label: 'Remote', count: 1 },
  ]);
  for (const [workArrangement, count] of [['On-site', 7], ['Remote', 1], ['Hybrid', 1]]) {
    const filters = { workArrangement };
    const matched = await Job.find(buildJobFilterConditions(filters)).lean();
    assert.equal(matched.length, count, workArrangement);
    const saved = (await Job.find({}).lean()).filter(job => jobMatchesSavedFilters({ job, filters }));
    assert.equal(saved.length, count, workArrangement);
  }
  const response = { set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await getJobMeta({ query: { company: 'Test' }, user: { role: 'admin' }, siteSettings: { experiencedJobsEnabled: true } }, response);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.data.workArrangements.sort(), ['Hybrid', 'On-site', 'Remote']);
});
