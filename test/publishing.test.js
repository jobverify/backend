import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.JWT_SECRET = 'publishing-tests-only-secret-of-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'https://app.jobverify.test';
const { createApp } = await import('../src/app.js');
const { default: HiringObservation } = await import('../src/models/HiringObservation.js');
const { default: SiteSettings } = await import('../src/models/SiteSettings.js');
const { default: ScraperStatus } = await import('../src/models/ScraperStatus.js');
const { default: Job } = await import('../src/models/Job.js');
const { compareObservations, indiaDay, readHiringSnapshot, captureHiringObservation, observationScope } = await import('../src/services/hiringObservationService.js');
const { getPublishingBuildFeed } = await import('../src/controllers/publishingController.js');
const { normalizeResponseJob } = await import('../src/controllers/jobController.js');
const current = { _id: '665f47f5f65f3f4d2e1d1001', key: 'private-key', scope: 'india-v1-all-types', generatedAt: '2026-10-10T08:00:00Z', totalJobs: 10, totalCompanies: 3, companies: [], locations: [], jobTypes: [] };
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(body) { this.body = body; return this; } }; }
const chain = value => ({ sort() { return this; }, select() { return this; }, limit() { return this; }, lean() { return this; }, exec: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

test('model-based four-category reporting uses a new observation scope', () => {
  assert.equal(observationScope({ experiencedJobsEnabled: true }), 'india-v3-all-types');
  const earlier = { ...current, generatedAt: '2026-10-03T08:00:00Z' };
  assert.equal(compareObservations({ ...current, scope: observationScope({}) }, earlier), null);
});
test('dates use India days and comparisons require an earlier identical scope', () => {
  assert.equal(indiaDay(new Date('2026-10-09T20:00:00Z')), '2026-10-10');
  const earlier = { ...current, generatedAt: '2026-10-03T08:00:00Z', totalJobs: 7 };
  assert.equal(compareObservations(current, earlier).jobsChange, 3);
  assert.equal(compareObservations(current, { ...earlier, scope: 'india-v1-early-career' }), null);
  assert.equal(compareObservations(current, current), null);
  assert.equal(compareObservations(current, null), null);
});
test('snapshot selects active public unexpired listings and omits blank company totals', async t => {
  t.mock.method(Job, 'aggregate', pipeline => { const query = JSON.stringify(pipeline); assert.match(query, /active/); assert.match(query, /closingDate/); assert.match(query, /isPublicIndia/); assert.match(query, /Full-time Experienced/); assert.match(query, /\$ne/); return { exec: async () => [{ totals: [{ count: 4 }], companyTotals: [{ count: 2 }], companies: [], locations: [], jobTypes: [] }] }; });
  const snapshot = await readHiringSnapshot({ experiencedJobsEnabled: false }, new Date(current.generatedAt));
  assert.equal(snapshot.totalJobs, 4);
  assert.equal(snapshot.scope, 'india-v3-early-career');
});
test('capture reuses an immutable daily observation and skips running collection', async t => {
  t.mock.method(SiteSettings, 'findById', () => chain({ experiencedJobsEnabled: true }));
  const find = t.mock.method(HiringObservation, 'findOne', () => chain(current));
  const exists = t.mock.method(ScraperStatus, 'exists', async () => true);
  assert.equal((await captureHiringObservation()).totalJobs, 10);
  assert.equal(exists.mock.calls.length, 0);
  find.mock.mockImplementation(() => chain(null));
  assert.equal(await captureHiringObservation(), null);
});
test('capture uses a deterministic database ID and resolves concurrent duplicate capture', async t => {
  t.mock.method(SiteSettings, 'findById', () => chain({}));
  let calls = 0;
  t.mock.method(HiringObservation, 'findOne', () => chain(++calls === 1 ? null : current));
  t.mock.method(ScraperStatus, 'exists', async () => false);
  t.mock.method(Job, 'aggregate', () => ({ exec: async () => [{ totals: [{ count: 10 }], companyTotals: [{ count: 3 }], companies: [], locations: [], jobTypes: [] }] }));
  t.mock.method(ScraperStatus, 'aggregate', () => ({ exec: async () => [] }));
  t.mock.method(HiringObservation, 'create', async input => { assert.equal(input._id, input.key); assert.match(input._id, /^\d{4}-\d{2}-\d{2}:india-v3-all-types$/); assert.equal(HiringObservation.schema.path('_id').instance, 'String'); const error = new Error('Concurrent capture'); error.code = 11000; throw error; });
  assert.equal((await captureHiringObservation()).totalJobs, current.totalJobs);
});
test('public build feed excludes incomplete or unavailable jobs and private rewrite/classifier state', async t => {
  t.mock.method(SiteSettings, 'findById', () => chain({}));
  t.mock.method(Job, 'aggregate', () => ({ exec: async () => [] }));
  const source = { _id: current._id, title: 'Intern', company: 'Test company', description: 'A full role description. '.repeat(15), city: 'Bangalore', sourceUrl: 'https://careers.example.com/role', applyUrl: 'https://careers.example.com/apply', classification: { secret: true }, sourceDescription: 'private source copy', descriptionRewrite: { status: 'published' } };
  t.mock.method(Job, 'find', () => chain([source, { ...source, _id: '665f47f5f65f3f4d2e1d1002', description: '' }]));
  const res = response(); await getPublishingBuildFeed({ query: {} }, res, error => { throw error; });
  assert.equal(Object.hasOwn(res.body.data, 'reports'), false);
  assert.equal(res.body.data.jobs.length, 1); assert.equal(res.body.data.jobs[0].classification, undefined); assert.equal(res.body.data.jobs[0].sourceDescription, undefined); assert.equal(Object.hasOwn(res.body.data.jobs[0], 'provenance'), false);
  const normalized = normalizeResponseJob({ ...source, provenance: { humanReviewed: false }, postClassification: { owner: 'private-worker', result: { internal: true } } }); assert.equal(Object.hasOwn(normalized, 'provenance'), false); assert.equal(normalized.postClassification, undefined);
});
test('retired public report endpoints return not found', async () => {
  const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/api/publishing/reports', '/api/publishing/reports/old-report']) assert.equal((await fetch(base + route)).status, 404);
    assert.equal((await fetch(`${base}/api/publishing/build-feed?cursor=invalid`)).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
