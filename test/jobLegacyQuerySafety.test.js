import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Job from '../src/models/Job.js';
import { getAllJobs } from '../src/controllers/jobController.js';

const response = () => ({
  statusCode: 200, body: null, set() { return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
for (const sort of ['newest', 'recommended']) {
  test(`legacy ${sort} query rejection is handled while summary is pending`, () => {
    execFileSync(process.execPath, ['--unhandled-rejections=strict',
      fileURLToPath(new URL('./helpers/legacyJobQueryChild.js', import.meta.url)), sort],
    { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'test' }, timeout: 15000 });
  });
}

test('legacy listing rejects unsafe/deep offsets before executing database work', async t => {
  t.mock.method(Job, 'find', () => { throw new Error('database must not be reached'); });
  for (const page of ['9007199254740992', 'Infinity', '1e9', '2.5', '-1', '1000000']) {
    const res = response();
    await getAllJobs({ query: { page }, user: null }, res);
    assert.equal(res.statusCode, 400, page);
  }
});

test('all legacy listing operations receive a finite database execution budget', async t => {
  const observed = [];
  const chain = () => ({
    select() { return this; }, sort() { return this; }, skip() { return this; },
    limit() { return this; }, lean() { return this; }, exec: async () => [],
  });
  t.mock.method(Job, 'find', (_filter, _projection, options) => { observed.push(['find', options]); return chain(); });
  t.mock.method(Job, 'aggregate', (_pipeline, options) => { observed.push(['aggregate', options]); return chain(); });
  t.mock.method(Job, 'countDocuments', async (_filter, options) => { observed.push(['count', options]); return 0; });
  t.mock.method(Job, 'distinct', async (_field, _filter, options) => { observed.push(['distinct', options]); return []; });
  for (const sort of ['newest', 'recommended']) {
    const res = response();
    await getAllJobs({ query: { sort }, user: { role: 'admin' },
      siteSettings: { experiencedJobsEnabled: false } }, res);
    assert.equal(res.statusCode, 200);
  }
  assert.deepEqual(observed.map(([kind]) => kind).sort(), ['aggregate', 'count', 'count', 'distinct', 'distinct', 'find']);
  for (const [kind, options] of observed) assert.equal(options?.maxTimeMS, 800, kind);
});
