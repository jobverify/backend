import assert from 'node:assert/strict';
import test from 'node:test';
import Job from '../src/models/Job.js';
import { getJobSnapshot } from '../src/controllers/jobSnapshotController.js';
import { getCompanies } from '../src/controllers/companyController.js';

const response = () => ({ status() { return this; }, set() {}, json(body) { this.body = body; } });

test('snapshot requests coalesce and cannot reuse a response from a different visibility policy', async t => {
  let calls = 0;
  t.mock.method(Job, 'aggregate', (_pipeline, options) => {
    assert.equal(options.maxTimeMS, 5000);
    const count = ++calls;
    return { exec: async () => [{ totals: [{ count }] }] };
  });
  const all = { siteSettings: { experiencedJobsEnabled: true } };
  const early = { siteSettings: { experiencedJobsEnabled: false } };
  const first = response(), same = response(), restricted = response();
  const unexpected = error => assert.fail(error);
  await Promise.all([getJobSnapshot(all, first, unexpected), getJobSnapshot(all, same, unexpected)]);
  await getJobSnapshot(early, restricted, unexpected);
  assert.equal(calls, 2);
  assert.equal(first.body.data.totalJobs, 1);
  assert.equal(same.body.data.totalJobs, 1);
  assert.equal(restricted.body.data.totalJobs, 2);
  assert.notEqual(first.body.data.scope, restricted.body.data.scope);
});

test('company caching includes query, pagination and visibility', async t => {
  let calls = 0;
  t.mock.method(Job, 'aggregate', (_pipeline, options) => {
    assert.equal(options.maxTimeMS, 5000);
    const count = ++calls;
    return { exec: async () => [{ companies: [], total: [{ count }] }] };
  });
  const request = (query = {}, enabled = true) => ({ query, siteSettings: { experiencedJobsEnabled: enabled } });
  async function count(req) { const res = response(); await getCompanies(req, res); return res.body.data.pagination.total; }
  assert.equal(await count(request()), 1);
  assert.equal(await count(request()), 1);
  assert.equal(await count(request({}, false)), 2);
  assert.equal(await count(request({ page: 2 })), 3);
  assert.equal(await count(request({ q: 'other-company' })), 4);
  assert.equal(calls, 4);
});
