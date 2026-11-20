import assert from 'node:assert/strict';
import test from 'node:test';
import Job from '../src/models/Job.js';
import { searchJobs, PremiumJobFiltersError } from '../src/services/jobSearchService.js';

test('shared search bounds database work and retains pagination for its consumers', async t => {
  let pipeline;
  let options;
  const rows = Array.from({ length: 6 }, (_, i) => ({
    _id: '507f1f77bcf86cd79943901' + i,
    title: 'Engineer ' + i, sortDate: new Date('2026-11-01'), clickCount: 0,
  }));
  t.mock.method(Job, 'aggregate', value => {
    pipeline = value;
    return { option(value) { options = value; return this; }, exec: async () => rows };
  });
  const result = await searchJobs({ query: 'Python', limit: 5 }, { user: {}, siteSettings: { billingEnabled: false } });
  assert.equal(result.data.length, 5);
  assert.equal(result.data[0].title, 'Engineer 0');
  assert.equal(result.pagination.limit, 5);
  assert.equal(result.pagination.hasNextPage, true);
  assert.equal(typeof result.pagination.nextCursor, 'string');
  assert.deepEqual(pipeline.at(-2), { $limit: 6 });
  assert.deepEqual(options, { maxTimeMS: 800 });
  assert.equal(pipeline[0].$match.status, 'active');
});

test('shared search preserves Premium filtering restrictions before database access', async t => {
  t.mock.method(Job, 'aggregate', () => { throw new Error('must not query'); });
  await assert.rejects(searchJobs({ query: 'Python' }, { user: {}, siteSettings: { billingEnabled: true } }),
    error => error instanceof PremiumJobFiltersError && error.feature === 'job_filters');
});

test('shared search rejects arbitrary database operators through the canonical contract', async () => {
  await assert.rejects(searchJobs({ $where: 'true' }, { siteSettings: { billingEnabled: false } }),
    error => error.code === 'UNKNOWN_FILTER');
});

test('shared search carries current public visibility and expiry constraints into the database', async t => {
  let filter;
  t.mock.method(Job, 'aggregate', pipeline => {
    filter = pipeline[0].$match;
    return { option() { return this; }, exec: async () => [] };
  });
  const result = await searchJobs({ limit: 5 }, { siteSettings: { experiencedJobsEnabled: false } });
  assert.deepEqual(result.data, []);
  assert.deepEqual(result.pagination, { limit: 5, hasNextPage: false, nextCursor: null });
  assert.equal(filter.status, 'active');
  const serialized = JSON.stringify(filter);
  assert.ok(serialized.includes('closingDate'));
  const categoryGuard = filter.$expr.$and.at(-1).$in[1];
  assert.ok(categoryGuard.includes('Full-time Fresher'));
  assert.ok(!categoryGuard.includes('Full-time Experienced'));
});
