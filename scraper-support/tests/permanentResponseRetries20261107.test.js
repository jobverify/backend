import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJsonWithRetry, fetchTextWithRetry } from '../utils/fetch.js';
import { withRetry, getRetryMetadata } from '../utils/retry.js';

for (const status of [307, 400, 405, 406, 422]) test(`shared HTTP ${status} is not repeated by nested retry layers`, async () => {
  let calls = 0;
  await assert.rejects(withRetry(() => fetchTextWithRetry('https://example.test/jobs', {
    attempts: 3, baseDelayMs: 0, fetchImpl: async () => { calls++; return new Response('', { status }); },
  }), { attempts: 4, baseDelayMs: 0 }), error => {
    assert.equal(error.abortRetries, true);
    assert.equal(getRetryMetadata(error).attemptsUsed, 1);
    return true;
  });
  assert.equal(calls, 1);
});

for (const body of ['<html>Maintenance</html>', '{invalid json']) test('deterministic JSON contract failure stops retries: ' + body, async () => {
  let calls = 0;
  await assert.rejects(fetchJsonWithRetry('https://example.test/jobs', {
    attempts: 3, baseDelayMs: 0, fetchImpl: async () => { calls++; return new Response(body, {
      headers: { 'content-type': body.startsWith('<') ? 'text/html' : 'application/json' },
    }); },
  }));
  assert.equal(calls, 1);
});

test('transient upstream errors retain recovery', async () => {
  let calls = 0;
  const result = await fetchJsonWithRetry('https://example.test/jobs', { attempts: 3, baseDelayMs: 0,
    fetchImpl: async () => ++calls === 1 ? new Response('', { status: 502 }) : Response.json({ jobs: [] }),
  });
  assert.deepEqual(result, { jobs: [] });
  assert.equal(calls, 2);
});

test('JSON cancellation reason remains opaque even when it is a SyntaxError', async () => {
  const controller = new AbortController(), reason = new SyntaxError('caller cancellation');
  const before = Object.getOwnPropertyDescriptors(reason);
  await assert.rejects(fetchJsonWithRetry('https://example.test/jobs', {
    signal: controller.signal, fetchImpl: async () => ({ ok: true, headers: new Headers(),
      json: async () => { controller.abort(reason); throw reason; },
    }),
  }), error => error === reason);
  assert.deepEqual(Object.getOwnPropertyDescriptors(reason), before);
});
