import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runVideoDrafts } from '../scripts/social-video-drafts.js';

const apiUrl = 'https://api.jobverify.in/api/social-video-drafts';
const env = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.actions.githubusercontent.com/oidc', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-secret' };
const claim = { postId: '1234567890abcdef12345678', renderId: 'render-1', leaseToken: 'private-lease', leaseUntil: '2026-11-20T04:40:00Z', revision: 0,
  facts: { id: '1234567890abcdef12345678', title: 'Software Engineer', company: 'Example', location: 'Bengaluru' }, factsHash: 'a'.repeat(64), planHash: 'b'.repeat(64),
  plan: { templateVersion: 'jobverify-reel-v6', jobUrl: 'https://www.jobverify.in/jobs/1234567890abcdef12345678', companyDomain: '', voice: 'en-IN-NeerjaNeural', script: 'Example is hiring a Software Engineer. Scan the QR code for full details and to apply. Follow JobVerify.in for more jobs.', width: 1080, height: 1920, fps: 30, minDuration: 15, maxDuration: 15, ctaHold: 3 } };
async function fakeRender(_claim, directory) {
  const files = {};
  for (const [kind, filename] of Object.entries({ video: 'video.mp4', cover: 'cover.jpg', subtitles: 'captions.srt' })) {
    const bytes = Buffer.from(`fixture-${kind}`); await writeFile(join(directory, filename), bytes);
    files[kind] = { path: filename, hash: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
  }
  return { artifacts: files, versions: { renderer: 'test-fixture' } };
}
const envelope = data => Response.json({ success: true, data });

test('renderer runner refreshes OIDC per call, uploads a complete package and caps a run at two jobs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reel-runner-')); const requests = []; let claims = 0; let identities = 0;
  try {
    const result = await runVideoDrafts({ apiUrl, env, workRoot: directory, render: fakeRender, fetcher: async (url, options) => {
      if (String(url).includes('/oidc?')) { identities++; assert.equal(new URL(url).searchParams.get('audience'), apiUrl); return Response.json({ value: `oidc-${identities}` }); }
      requests.push({ url: String(url), options }); assert.equal(options.headers.Authorization, `Bearer oidc-${identities}`);
      if (String(url).endsWith('/claim')) { claims++; return envelope({ done: false, claim: { ...claim, renderId: `render-${claims}` } }); }
      if (String(url).includes('/assets/')) { assert.equal(options.headers['X-Social-Lease'], claim.leaseToken); return envelope({ hash: createHash('sha256').update(options.body).digest('hex') }); }
      if (String(url).endsWith('/complete')) { const body = JSON.parse(options.body); assert.deepEqual(Object.keys(body.artifacts).sort(), ['cover', 'subtitles', 'video']); assert.equal(body.planHash, claim.planHash); return envelope({ status: 'draft' }); }
      throw new Error('Unexpected request');
    } });
    assert.equal(result.rendered, 2); assert.equal(result.failed, 0); assert.equal(claims, 2);
    assert.equal(requests.filter(row => row.url.includes('/assets/')).length, 6); assert.equal(identities, requests.length);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('empty or disabled generation is a successful no-op and does not call renderer', async () => {
  const result = await runVideoDrafts({ apiUrl, env, render: () => assert.fail('no render expected'), fetcher: async url => String(url).includes('/oidc?') ? Response.json({ value: 'oidc' }) : envelope({ done: true, reason: 'disabled' }) });
  assert.deepEqual(result, { rendered: 0, failed: 0, outcome: 'disabled' });
});

test('failed narration records only a bounded failure and never completes that claim', async () => {
  let claims = 0; const paths = []; const bodies = [];
  const result = await runVideoDrafts({ apiUrl, env, render: async () => { const error = new Error('provider body private-lease'); error.reason = 'narration_failed'; throw error; }, fetcher: async (url, options) => {
    if (String(url).includes('/oidc?')) return Response.json({ value: 'oidc' });
    paths.push(String(url)); bodies.push(options.body);
    if (String(url).endsWith('/claim')) return envelope(++claims === 1 ? { done: false, claim } : { done: true });
    return envelope({ state: 'failed' });
  } });
  assert.equal(result.failed, 1); assert.equal(paths.some(path => path.endsWith('/complete')), false);
  const failure = JSON.parse(bodies[1]); assert.equal(failure.reason, 'narration_failed'); assert.equal(failure.retryable, true); assert.equal('message' in failure, false);
});

test('renews a live render lease and stops completion after heartbeat fencing', async () => {
  let claims = 0; let heartbeat = 0; const paths = [];
  const result = await runVideoDrafts({ apiUrl, env, heartbeatMs: 10, render: async (_claim, _dir, { signal }) => {
    await new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); setTimeout(resolve, 80); });
    assert.fail('render must abort after lease lost');
  }, fetcher: async (url) => {
    if (String(url).includes('/oidc?')) return Response.json({ value: 'oidc' });
    paths.push(String(url));
    if (String(url).endsWith('/claim')) return envelope(++claims === 1 ? { done: false, claim } : { done: true });
    if (String(url).endsWith('/heartbeat')) { heartbeat++; return new Response('', { status: 409 }); }
    return envelope({ state: 'failed' });
  } });
  assert.equal(heartbeat, 1); assert.equal(result.failed, 1); assert.equal(paths.some(path => path.endsWith('/complete')), false);
});

test('rejects non HTTPS endpoints and malformed claim data without leaking identities', async () => {
  await assert.rejects(runVideoDrafts({ apiUrl: 'http://example.com/api/social-video-drafts', env }), /HTTPS/);
  await assert.rejects(runVideoDrafts({ apiUrl, env, fetcher: async url => String(url).includes('/oidc?') ? Response.json({ value: 'oidc-secret' }) : new Response('request-secret', { status: 401 }) }), error => !error.message.includes('request-secret') && !error.message.includes('oidc-secret'));
});
