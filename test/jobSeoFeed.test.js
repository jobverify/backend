import assert from 'node:assert/strict';
import test from 'node:test';
import Job from '../src/models/Job.js';
import { getJobSeoFeed } from '../src/controllers/jobController.js';

test('SEO feed filters closing dates while retaining public visibility and response shape', async (t) => {
  let filter;
  const query = { sort() { return this; }, select() { return this; }, lean() { return this; }, async exec() { return []; } };
  t.mock.method(Job, 'find', value => { filter = value; return query; });
  const res = { set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await getJobSeoFeed({ siteSettings: { experiencedJobsEnabled: false } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { code: 200, success: true, data: [] });
  const findExpiry = value => {
    if (!value || typeof value !== 'object') return false;
    if (value.closingDate?.$gt instanceof Date) return true;
    return Object.values(value).some(findExpiry);
  };
  assert.ok(findExpiry(filter), 'expired closing dates must be excluded at query time');
  assert.match(JSON.stringify(filter), /active/);
  assert.match(JSON.stringify(filter), /isPublicIndia/);
});
