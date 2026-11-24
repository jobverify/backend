import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialProvider } from '../src/social/providers.js';
import { encryptSocialToken } from '../src/social/security.js';

const env = { SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'), PUBLIC_API_ORIGIN: 'https://api.jobverify.in', SOCIAL_LINKEDIN_CLIENT_ID: 'client', SOCIAL_LINKEDIN_CLIENT_SECRET: 'client-secret', SOCIAL_LINKEDIN_ORGANIZATION_ID: '1', SOCIAL_INSTAGRAM_CLIENT_ID: 'client', SOCIAL_INSTAGRAM_CLIENT_SECRET: 'client-secret', SOCIAL_INSTAGRAM_ACCOUNT_ID: '2' };
const account = platform => ({ _id: platform, destination: platform === 'linkedin' ? 'urn:li:organization:1' : '2', accessToken: encryptSocialToken('access-secret', env.SOCIAL_TOKEN_ENCRYPTION_KEY) });
const delivery = platform => ({ platform, destination: account(platform).destination, phase: 'prepare', providerState: {}, snapshot: { caption: 'Acme is hiring an engineer', facts: { title: 'Engineer', company: 'Acme' }, image: { hash: 'a'.repeat(64) } } });
const response = (data, status = 200, headers = {}) => new Response(data === null ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

test('LinkedIn uploads the approved bytes, waits for AVAILABLE, and saves the authoritative post ID', async () => {
  const calls = []; const replies = [response({ value: { image: 'urn:li:image:123', uploadUrl: 'https://www.linkedin.com/dms-uploads/123' } }), response(null, 201), response({ status: 'AVAILABLE' }), response(null, 201, { 'x-restli-id': 'urn:li:share:456' })];
  const provider = createSocialProvider({ env, fetch: async (url, options) => { calls.push({ url: String(url), ...options }); return replies.shift(); } });
  let row = delivery('linkedin'); const acct = account('linkedin'); const context = { now: new Date('2026-11-20T04:30:00Z'), getImage: async () => Buffer.from('approved JPEG') };
  row = { ...row, ...await provider.step(row, acct, context) }; assert.equal(row.phase, 'upload');
  row = { ...row, ...await provider.step(row, acct, context) }; assert.equal(row.phase, 'poll');
  row = { ...row, ...await provider.step(row, acct, context) }; assert.equal(row.phase, 'publish');
  const receipt = await provider.publish(row, acct); assert.equal(receipt.providerId, 'urn:li:share:456');
  assert.equal(calls[0].headers['Linkedin-Version'], '202611');
  assert.equal(JSON.parse(calls[0].body).initializeUploadRequest.owner, 'urn:li:organization:1');
  assert.equal(calls[1].method, 'PUT'); assert.equal(calls[1].body.toString(), 'approved JPEG');
  const payload = JSON.parse(calls[3].body);
  assert.equal(payload.author, 'urn:li:organization:1'); assert.equal(payload.content.media.id, 'urn:li:image:123'); assert.equal(payload.commentary, 'Acme is hiring an engineer');
  assert.equal(replies.length, 0);
});

test('Instagram creates a public-image container, polls once per minute and publishes only FINISHED media', async () => {
  const calls = []; const replies = [response({ id: 'container' }), response({ status_code: 'IN_PROGRESS' }), response({ status_code: 'FINISHED' }), response({ id: 'published' })];
  const provider = createSocialProvider({ env, fetch: async (url, options) => { calls.push({ url: String(url), ...options }); return replies.shift(); } });
  const now = new Date('2026-11-20T04:30:00Z'); const context = { now, imageUrl: 'https://api.jobverify.in/api/social-assets/approved.jpg' };
  let row = delivery('instagram'); const acct = account('instagram');
  row = { ...row, ...await provider.step(row, acct, context) };
  assert.equal(row.phase, 'poll'); assert.equal(row.nextPollAt.toISOString(), '2026-11-20T04:31:00.000Z');
  row = { ...row, ...await provider.step(row, acct, { ...context, now: new Date('2026-11-20T04:31:00Z') }) }; assert.equal(row.phase, 'poll');
  row = { ...row, ...await provider.step(row, acct, { ...context, now: new Date('2026-11-20T04:32:00Z') }) }; assert.equal(row.phase, 'publish');
  assert.equal((await provider.publish(row, acct)).providerId, 'published');
  assert.equal(new URLSearchParams(calls[0].body).get('image_url'), context.imageUrl);
  assert.equal(new URLSearchParams(calls[3].body).get('creation_id'), 'container');
  assert.match(calls[3].url, /\/2\/media_publish$/);
});

test('LinkedIn preserves approved plaintext through little encoding and verifies the exact public image receipt', async () => {
  const caption = 'Engineer (Platform) [India] @Acme #Jobs | {team} <role> * _ ~ \\ https://jobverify.in/?utm_source=linkedin';
  const encoded = 'Engineer \\(Platform\\) \\[India\\] \\@Acme \\#Jobs \\| \\{team\\} \\<role\\> \\* \\_ \\~ \\\\ https://jobverify.in/?utm\\_source=linkedin';
  const row = { ...delivery('linkedin'), phase: 'publish', providerState: { imageId: 'urn:li:image:123' } }; row.snapshot.caption = caption;
  let payload;
  const published = { author: row.destination, commentary: encoded, lifecycleState: 'PUBLISHED', visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED' }, content: { media: { id: 'urn:li:image:123' } } };
  const provider = createSocialProvider({ env, fetch: async (_url, options) => {
    if (options.method === 'POST') { payload = JSON.parse(options.body); return response(null, 201, { 'x-restli-id': 'urn:li:share:456' }); }
    return response(published);
  } });
  await provider.publish(row, account('linkedin')); assert.equal(payload.commentary, encoded); assert.equal(row.snapshot.caption, caption);
  assert.equal((await provider.receipt(row, account('linkedin'), 'urn:li:share:456')).published, true);
  published.content.media.id = 'urn:li:image:wrong'; assert.equal(await provider.receipt(row, account('linkedin'), 'urn:li:share:456'), null);
  published.content.media.id = 'urn:li:image:123'; published.visibility = 'CONNECTIONS'; assert.equal(await provider.receipt(row, account('linkedin'), 'urn:li:share:456'), null);
  published.visibility = 'PUBLIC'; published.distribution.feedDistribution = 'NONE'; assert.equal(await provider.receipt(row, account('linkedin'), 'urn:li:share:456'), null);
});

test('Instagram reconciles the supplied media directly and requires the approved owner and caption', async () => {
  const row = delivery('instagram'); const calls = [];
  const media = { id: '123', owner: { id: '2' }, caption: row.snapshot.caption, permalink: 'https://www.instagram.com/p/receipt/' };
  const provider = createSocialProvider({ env, fetch: async url => { calls.push(String(url)); return response(media); } });
  assert.equal((await provider.receipt(row, account('instagram'), '123')).published, true);
  assert.match(calls[0], /\/123\?fields=/); assert.doesNotMatch(calls[0], /\/media\?/);
  media.owner.id = '999'; assert.equal(await provider.receipt(row, account('instagram'), '123'), null);
  media.owner.id = '2'; media.caption = 'Different content'; assert.equal(await provider.receipt(row, account('instagram'), '123'), null);
});

test('a matching LinkedIn caption cannot reconcile an unrelated image', async () => {
  const row = { ...delivery('linkedin'), providerState: { imageId: 'urn:li:image:123' } };
  const provider = createSocialProvider({ env, fetch: async () => response({ author: row.destination, commentary: row.snapshot.caption, lifecycleState: 'PUBLISHED', visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED' }, content: { media: { id: 'urn:li:image:wrong' } } }) });
  assert.equal(await provider.receipt(row, account('linkedin'), 'urn:li:share:456'), null);
});

test('processing failures and unsafe upload locations cannot advance to publication', async () => {
  const provider = createSocialProvider({ env, fetch: async () => response({ status_code: 'IN_PROGRESS' }) });
  await assert.rejects(provider.step({ ...delivery('instagram'), phase: 'poll', providerState: { containerId: 'container', polls: 5 } }, account('instagram'), { now: new Date() }), error => error.retryable === false);
  const bad = createSocialProvider({ env, fetch: async () => response({ value: { image: 'urn:li:image:123', uploadUrl: 'https://evil.example/steal' } }) });
  await assert.rejects(bad.step(delivery('linkedin'), account('linkedin'), { now: new Date() }));
});

test('publication distinguishes explicit rejection, rate limits, and ambiguous server/network outcomes', async () => {
  const row = { ...delivery('instagram'), phase: 'publish', providerState: { containerId: 'container' } };
  for (const [status, rejected, retryable] of [[400, true, false], [429, true, true], [503, false, true]]) {
    const provider = createSocialProvider({ env, fetch: async () => response({ error: { message: 'access-secret must never leak' } }, status, { 'retry-after': '12' }) });
    await assert.rejects(provider.publish(row, account('instagram')), error => {
      assert.equal(error.rejected, rejected); assert.equal(error.retryable, retryable); assert.doesNotMatch(error.message, /access-secret/); if (status === 429) assert.equal(error.retryAfterMs, 12000); return true;
    });
  }
  const provider = createSocialProvider({ env, fetch: async () => { throw new Error('Network failure'); } });
  await assert.rejects(provider.publish(row, account('instagram')), error => !error.rejected);
});

test('Instagram refresh uses the existing long-lived token and LinkedIn does not assume a refresh grant', async () => {
  const calls = []; const provider = createSocialProvider({ env, fetch: async url => { calls.push(String(url)); return response({ access_token: 'new-token', expires_in: 5184000 }); } });
  assert.equal(await provider.refresh(account('linkedin')), null);
  const result = await provider.refresh(account('instagram'));
  assert.equal(result.accessToken, 'new-token'); assert.equal(result.expiresIn, 5184000);
  assert.equal(new URL(calls[0]).searchParams.get('grant_type'), 'ig_refresh_token');
});
