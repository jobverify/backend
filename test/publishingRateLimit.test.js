import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import * as rateLimits from '../src/utils/rateLimit.js';

test('only authenticated read requests receive the build feed quota', t => {
  const token = 'build-only-token-at-least-32-characters';
  const previous = process.env.JOBVERIFY_PUBLISHING_TOKEN;
  process.env.JOBVERIFY_PUBLISHING_TOKEN = token;
  t.after(() => {
    if (previous === undefined) delete process.env.JOBVERIFY_PUBLISHING_TOKEN;
    else process.env.JOBVERIFY_PUBLISHING_TOKEN = previous;
  });
  const request = { method: 'GET', originalUrl: '/API/publishing/BUILD-feed/?limit=200', headers: { authorization: `Bearer ${token}` } };
  assert.equal(rateLimits.getApiRateLimitProfile(request), 'publishing-build');
  assert.equal(rateLimits.getApiRateLimitProfile({ ...request, headers: {} }), 'publishing');
  assert.equal(rateLimits.getApiRateLimitProfile({ ...request, headers: { authorization: 'Bearer invalid' } }), 'publishing');
  assert.equal(rateLimits.getApiRateLimitProfile({ ...request, method: 'POST' }), 'mutation');
  assert.equal(rateLimits.getApiRateLimitProfile({ ...request, originalUrl: '/api/jobs' }), 'expensive-search');
});

test('publishing pagination has a separate quota from interactive search', () => {
  assert.equal(rateLimits.getApiRateLimitProfile({ method: 'GET', originalUrl: '/api/publishing/build-feed?limit=200' }), 'publishing');
  assert.equal(rateLimits.getApiRateLimitProfile({ method: 'GET', originalUrl: '/api/jobs' }), 'expensive-search');
});

test('public and authenticated build quotas are independent and finite', async t => {
  const token = 'build-only-token-at-least-32-characters';
  const previous = process.env.JOBVERIFY_PUBLISHING_TOKEN;
  process.env.JOBVERIFY_PUBLISHING_TOKEN = token;
  t.after(() => {
    if (previous === undefined) delete process.env.JOBVERIFY_PUBLISHING_TOKEN;
    else process.env.JOBVERIFY_PUBLISHING_TOKEN = previous;
  });
  assert.equal(typeof rateLimits.createPublishingRateLimiter, 'function');
  const app = express();
  app.use(rateLimits.createPublishingRateLimiter({ NODE_ENV: 'test', ENABLE_RATE_LIMITING: 'true' }));
  app.use(rateLimits.createPublishingBuildRateLimiter({ NODE_ENV: 'test', ENABLE_RATE_LIMITING: 'true' }));
  app.get('/api/publishing/build-feed', (_req, res) => res.json({ success: true }));
  app.get('/api/jobs', (_req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (let i = 0; i < 600; i += 1) {
      const response = await fetch(`${base}/api/publishing/build-feed?limit=200`);
      assert.equal(response.status, 200, `page ${i + 1}`);
      await response.text();
    }
    const blocked = await fetch(`${base}/api/publishing/build-feed`);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
    assert.equal((await blocked.json()).error, 'rate_limited');
    const options = { headers: { Authorization: `Bearer ${token}` } };
    for (let i = 0; i < 3000; i += 1) {
      const response = await fetch(`${base}/api/publishing/build-feed?limit=200`, options);
      assert.equal(response.status, 200, `authenticated page ${i + 1}`);
      await response.text();
    }
    const buildBlocked = await fetch(`${base}/api/publishing/build-feed`, options);
    assert.equal(buildBlocked.status, 429);
    assert.ok(Number(buildBlocked.headers.get('Retry-After')) > 0);
    assert.equal((await buildBlocked.json()).error, 'rate_limited');
    const search = await fetch(`${base}/api/jobs`);
    assert.equal(search.status, 200);
    await search.text();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
