import test from 'node:test';
import assert from 'node:assert/strict';
import { runPublisher } from '../scripts/social-publisher.js';

const env = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.actions.githubusercontent.com/oidc?request=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'github-request-secret' };
const apiUrl = 'https://api.jobverify.in/api/social-publisher/run';
test('the runner obtains fresh OIDC tokens, resumes the same batch, reports results and exits', async () => {
  let now = Date.parse('2026-11-20T04:30:00Z'); const requests = []; let iterations = 0;
  const fetcher = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).startsWith('https://example.actions.')) return Response.json({ value: 'short-lived-oidc' });
    const body = JSON.parse(options.body); assert.deepEqual(body, iterations ? { batchId: 'batch-1' } : {}); iterations++;
    return Response.json({ success: true, data: { batchId: 'batch-1', done: iterations === 2, outcome: iterations === 2 ? 'published' : 'running', nextPollAt: '2026-11-20T04:31:00Z', deadline: '2026-11-20T04:40:00Z', deliveries: [{ platform: 'instagram', status: iterations === 2 ? 'published' : 'processing' }] } });
  };
  const result = await runPublisher({ apiUrl, env, fetcher, now: () => now, sleep: async ms => { now += ms; } });
  assert.equal(result.outcome, 'published'); assert.equal(iterations, 2);
  assert.equal(new URL(requests[0].url).searchParams.get('audience'), apiUrl);
  assert.equal(requests[1].options.headers.Authorization, 'Bearer short-lived-oidc');
  assert.equal(now, Date.parse('2026-11-20T04:31:00Z'));
});

test('a paused or empty queue exits without a polling loop; invalid identities fail without leaking credentials', async () => {
  let apiCalls = 0;
  const result = await runPublisher({ apiUrl, env, fetcher: async url => String(url).includes('/oidc') ? Response.json({ value: 'token' }) : (apiCalls++, Response.json({ success: true, data: { done: true, outcome: 'paused', deliveries: [] } })) });
  assert.equal(result.outcome, 'paused'); assert.equal(apiCalls, 1);
  await assert.rejects(runPublisher({ apiUrl, env, fetcher: async url => String(url).includes('/oidc') ? Response.json({ value: 'token' }) : new Response('github-request-secret', { status: 401 }) }), error => !error.message.includes('github-request-secret'));
  await assert.rejects(runPublisher({ apiUrl: 'http://evil.example/run', env }));
});
