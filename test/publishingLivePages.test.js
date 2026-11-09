import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'publishing-live-tests-only-secret-at-least-32-characters';
process.env.CORS_ORIGIN = 'https://www.jobverify.test';
process.env.JOBVERIFY_PUBLISHING_TOKEN = 'publishing-live-test-token-at-least-32-characters';
const token = process.env.JOBVERIFY_PUBLISHING_TOKEN;
const { createApp } = await import('../src/app.js');
const { default: Job } = await import('../src/models/Job.js');
const { default: SiteSettings } = await import('../src/models/SiteSettings.js');
const { getApiRateLimitProfile } = await import('../src/utils/rateLimit.js');
const { getJobSeoFeed } = await import('../src/controllers/jobController.js');
const id = '665f47f5f65f3f4d2e1d1001';
const chain = value => ({ sort() { return this; }, select() { return this; }, lean() { return this; }, exec: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

test('trusted page rendering uses public visibility and returns only public job fields', async t => {
  t.mock.method(SiteSettings, 'findById', () => chain({ experiencedJobsEnabled: true }));
  t.mock.method(Job, 'findOne', query => {
    assert.equal(query.status, 'active');
    assert.ok(JSON.stringify(query).includes('isPublicIndia'));
    return chain({ _id: id, title: 'Engineer', company: 'Example', sourceUrl: 'https://careers.example.com/job', sourceDescription: 'Private raw copy', classification: { private: true } });
  });
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/publishing/jobs/${id}`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid-token' } })).status, 401);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Jobverify-Publishing'), '1');
    const body = await response.json();
    assert.equal(body.data.title, 'Engineer');
    assert.equal(body.data.sourceDescription, undefined);
    assert.equal(body.data.classification, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('only authenticated publishing job requests avoid the shared visitor IP quota', () => {
  const request = { method: 'GET', originalUrl: `/api/publishing/jobs/${id}`, headers: { authorization: `Bearer ${token}` } };
  assert.equal(getApiRateLimitProfile(request), 'publishing-render');
  assert.notEqual(getApiRateLimitProfile({ ...request, headers: {} }), 'publishing-render');
  assert.notEqual(getApiRateLimitProfile({ ...request, originalUrl: '/api/jobs' }), 'publishing-render');
  assert.notEqual(getApiRateLimitProfile({ ...request, method: 'POST' }), 'publishing-render');
});

test('the SEO feed excludes unavailable application links and non-indexable descriptions', async t => {
  const row = { _id: id, title: 'Engineer', company: 'Example', sourceUrl: 'https://careers.example.com/job', applyUrl: 'https://careers.example.com/apply' };
  t.mock.method(Job, 'find', query => {
    assert.ok(query.description.$regex.test('A complete sourced role description. '.repeat(10)));
    assert.equal(query.description.$regex.test('Short description'), false);
    return chain([row, { ...row, _id: '665f47f5f65f3f4d2e1d1002', sourceUrl: 'https://example.myworkdayjobs.com/job', applyUrl: 'https://example.myworkdayjobs.com/job', workdayApplicationStatus: 'unavailable', workdayApplicationStatusCheckedAt: new Date() }, { ...row, _id: '665f47f5f65f3f4d2e1d1003', sourceUrl: 'javascript:alert(1)' }]);
  });
  const res = { status(code) { this.code = code; return this; }, set() { return this; }, json(body) { this.body = body; return this; } };
  await getJobSeoFeed({ siteSettings: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(String(res.body.data[0].id), id);
});
