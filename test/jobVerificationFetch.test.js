import assert from 'node:assert/strict';
import test from 'node:test';
const { createGuardedFetcher } = await import('../src/jobVerification/safeFetch.js');

test('guarded fetch rejects mixed public/private DNS answers before making a request', async () => {
  let requests = 0;
  const fetch = createGuardedFetcher({ lookup: async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }], request: async () => { requests++; } });
  await assert.rejects(fetch('https://example.com/jobs/1'), { code: 'unsafe_destination' });
  assert.equal(requests, 0);
});

test('guarded fetch validates every redirect and never requests a metadata endpoint', async () => {
  let requests = 0;
  const fetch = createGuardedFetcher({ lookup: async () => [{ address: '93.184.216.34', family: 4 }], request: async () => {
    requests++;
    return { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' }, body: '' };
  } });
  await assert.rejects(fetch('https://example.com/jobs/1'), { code: 'unsafe_destination' });
  assert.equal(requests, 1);
});

test('guarded fetch pins the validated address and bounds the downloaded body', async () => {
  const fetch = createGuardedFetcher({ lookup: async () => [{ address: '93.184.216.34', family: 4 }], request: async (_url, options) => {
    assert.equal(options.address, '93.184.216.34');
    return { status: 200, headers: { 'content-type': 'text/html' }, body: '<h1>A real vacancy</h1>' };
  } });
  const result = await fetch('https://example.com/jobs/1');
  assert.equal(result.status, 200);
  assert.equal(result.url, 'https://example.com/jobs/1');
  await assert.rejects(fetch('https://example.com/jobs/1', { maxBytes: 5 }), { code: 'response_too_large' });
});

test('abort prevents queued destination checks from starting', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = createGuardedFetcher({ lookup: async () => { throw new Error('must not look up'); } });
  await assert.rejects(fetch('https://example.com/jobs/1', { signal: controller.signal }));
});

test('guarded API requests negotiate JSON through the same pinned transport', async () => {
  const fetch = createGuardedFetcher({ lookup: async () => [{ address: '93.184.216.34', family: 4 }], request: async (_url, options) => {
    assert.equal(options.accept, 'application/json');
    return { status: 200, headers: { 'content-type': 'application/json' }, body: '{"id":"123"}' };
  } });
  assert.equal((await fetch('https://api.lever.co/v0/postings/acme/123', { accept: 'application/json' })).body, '{"id":"123"}');
});
