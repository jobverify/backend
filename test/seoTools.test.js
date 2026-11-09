import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { findIndexedPages } from '../src/seo/indexedPages.js';
import { requestProviderJson } from '../src/seo/providerHttp.js';
import { createSeoToolsRouter } from '../src/seo/seoToolsRoutes.js';

const env = { SERPAPI_KEY: 'fixture-serp-key', SEO_TOOLS_TOKEN: 'fixture-scoped-token-at-least-32-characters' };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('keyword lookup uses a quoted Google site query, filters host boundaries, preserves rank and deduplicates URLs', async () => {
  let requested;
  const report = await findIndexedPages({ domain: 'example.com', keyword: '"remote developer"' }, {
    env, fetchImpl: async (url, options) => {
      requested = new URL(url);
      assert.equal(options.redirect, 'error');
      return json({ organic_results: [
        { position: 1, link: 'https://example.com.evil.org/jobs', title: 'Remote developer' },
        { position: 2, link: 'https://jobs.example.com/role#top', title: 'Remote developer jobs', snippet: 'Find roles.' },
        { position: 3, link: 'https://jobs.example.com/role', title: 'Remote developer jobs' },
        { position: 4, link: 'https://example.com/other', title: 'Remote developers' },
        { position: 5, link: 'javascript:alert(1)', title: 'Remote developer' },
      ] });
    },
  });
  assert.equal(requested.origin, 'https://serpapi.com');
  assert.equal(requested.searchParams.get('q'), 'site:example.com "remote developer"');
  assert.equal(requested.searchParams.get('engine'), 'google');
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].rank, 2);
  assert.equal(report.results[0].url, 'https://jobs.example.com/role');
  assert.deepEqual(report.results[0].matchedFields, ['title']);
  assert.equal(report.unverifiedCount, 1);
  assert.match(report.notes.join(' '), /not.*traffic/i);
});

test('lookup rejects malformed targets and reports missing credentials without fetching', async () => {
  for (const domain of ['localhost', '127.0.0.1', 'https://user:pass@example.com', 'https://example.com/path', 'example.com:443', 'example.com site:evil.com']) {
    await assert.rejects(findIndexedPages({ domain, keyword: 'jobs' }, { env }), error => error.status === 400);
  }
  await assert.rejects(findIndexedPages({ domain: 'example.com', keyword: 'jobs "OR" secret' }, { env }), error => error.status === 400);
  await assert.rejects(findIndexedPages({ domain: 'example.com', keyword: 'jobs' }, { env: {} }), error => error.status === 503);
});

test('empty Google results are an explicit empty report; provider errors never echo secrets', async () => {
  const report = await findIndexedPages({ domain: 'example.com', keyword: 'jobs' }, { env, fetchImpl: async () => json({ organic_results: [] }) });
  assert.deepEqual(report.results, []);
  assert.match(report.summary, /0/);
  await assert.rejects(findIndexedPages({ domain: 'example.com', keyword: 'jobs' }, {
    env, fetchImpl: async () => json({ error: 'fixture-serp-key is invalid' }),
  }), error => error.status === 502 && !error.message.includes(env.SERPAPI_KEY));
});

test('provider transport bounds response bytes and masks network and non-JSON failures', async () => {
  await assert.rejects(requestProviderJson('https://provider.example', {}, { maxBytes: 4, fetchImpl: async () => new Response('123456') }), /too large/i);
  await assert.rejects(requestProviderJson('https://provider.example', {}, { fetchImpl: async () => { throw new Error('secret-key'); } }), error => !error.message.includes('secret-key'));
  await assert.rejects(requestProviderJson('https://provider.example', {}, { fetchImpl: async () => new Response('not JSON') }), /invalid.*response/i);
});

async function withRouter(options, run) {
  const app = express();
  app.use('/api/seo', createSeoToolsRouter(options));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}/api/seo`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('scoped tools reject cookies and wrong tokens; valid bearer calls are bounded and no-store', async () => {
  let calls = 0;
  await withRouter({ env, requestLimit: 10, findPages: async input => { calls++; return { results: [], keyword: input.keyword }; } }, async base => {
    const post = (headers, payload = {}) => fetch(`${base}/indexed-pages`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
    for (const headers of [{}, { cookie: 'token=admin-cookie' }, { authorization: 'Bearer wrong' }]) {
      const res = await post(headers);
      assert.equal(res.status, 401);
      await res.json();
    }
    assert.equal(calls, 0);
    const res = await post({ authorization: `Bearer ${env.SEO_TOOLS_TOKEN}`, origin: 'chrome-extension://fixture' }, { keyword: 'jobs' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).data.keyword, 'jobs');
    assert.equal(calls, 1);
    const large = await post({ authorization: `Bearer ${env.SEO_TOOLS_TOKEN}` }, { value: 'x'.repeat(40_000) });
    assert.equal(large.status, 413);
    await large.json();
    assert.equal(calls, 1);
  });
});

test('SEO request quota remains active in test/development and returns Retry-After', async () => {
  await withRouter({ env, requestLimit: 1, findPages: async () => ({ results: [] }) }, async base => {
    const options = { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.SEO_TOOLS_TOKEN}` }, body: '{}' };
    assert.equal((await fetch(`${base}/indexed-pages`, options)).status, 200);
    const res = await fetch(`${base}/indexed-pages`, options);
    assert.equal(res.status, 429);
    assert.ok(Number(res.headers.get('retry-after')) > 0);
    await res.json();
  });
});

test('provider concurrency rejects a third request and releases slots after completion', { timeout: 5000 }, async () => {
  let entered = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await withRouter({ env, audit: async () => { entered++; await gate; return { score: 100 }; } }, async base => {
    const options = { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.SEO_TOOLS_TOKEN }, body: '{}' };
    const first = fetch(base + '/audit', options);
    const second = fetch(base + '/audit', options);
    try {
      const deadline = Date.now() + 2000;
      while (entered < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(entered, 2);
      const third = await fetch(base + '/audit', options);
      assert.equal(third.status, 429);
      assert.equal(third.headers.get('retry-after'), '2');
      await third.json();
    } finally { release(); await Promise.all([first, second]); }
    const next = await fetch(base + '/audit', options);
    assert.equal(next.status, 200);
    await next.json();
  });
});

test('application mounts scoped bearer tools without weakening cookie-route CSRF protection', async () => {
  const values = { NODE_ENV: 'test', JWT_SECRET: 'fixture-jwt-secret-at-least-32-characters', CORS_ORIGIN: 'https://app.example.com', SEO_TOOLS_TOKEN: env.SEO_TOOLS_TOKEN, ANTHROPIC_API_KEY: '', ANTHROPIC_MODEL: '' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  let server;
  try {
    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    const body = JSON.stringify({ url: 'https://example.com', title: 'Jobs' });
    const denied = await fetch(base + '/api/seo/audit', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'token=fixture-cookie' }, body });
    assert.equal(denied.status, 401);
    await denied.json();
    const allowed = await fetch(base + '/api/seo/audit', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.SEO_TOOLS_TOKEN, origin: 'chrome-extension://fixture' }, body });
    assert.equal(allowed.status, 503);
    assert.equal((await allowed.json()).code, 'audit_not_configured');
    const sessionMutation = await fetch(base + '/api/user/profile', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'token=fixture-cookie', origin: 'https://untrusted.example' }, body: '{}' });
    assert.equal(sessionMutation.status, 403);
    await sessionMutation.json();
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
