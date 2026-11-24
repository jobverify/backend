import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import * as security from '../src/social/security.js';
import { createSocialProvider } from '../src/social/providers.js';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'video', alg: 'RS256', use: 'sig' };
const env = { SOCIAL_GITHUB_REPOSITORY_ID: '123', SOCIAL_GITHUB_OWNER_ID: '456', SOCIAL_GITHUB_REPOSITORY: 'jobverify/backend', SOCIAL_OIDC_AUDIENCE: 'https://api.jobverify.in/api/social-publisher/run', SOCIAL_VIDEO_OIDC_AUDIENCE: 'https://api.jobverify.in/api/social-video-drafts', SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') };
const claims = { repository_id: '123', repository_owner_id: '456', repository: 'jobverify/backend', ref: 'refs/heads/main', workflow_ref: 'jobverify/backend/.github/workflows/social-video-drafts.yml@refs/heads/main', event_name: 'workflow_run', sub: 'repo:jobverify/backend:ref:refs/heads/main', run_id: '987' };
const token = (overrides = {}, audience = env.SOCIAL_VIDEO_OIDC_AUDIENCE) => jwt.sign({ ...claims, ...overrides }, privateKey, { algorithm: 'RS256', keyid: 'video', issuer: 'https://token.actions.githubusercontent.com', audience, expiresIn: 300 });

test('renderer OIDC is role-separated and restricts exact signed workflow/repository/ref/events', async () => {
  assert.equal(typeof security.verifyVideoRendererToken, 'function');
  const options = { env, keys: [jwk] };
  for (const event_name of ['workflow_run', 'workflow_dispatch', 'schedule']) assert.equal((await security.verifyVideoRendererToken(token({ event_name }), options)).run_id, '987');
  await assert.rejects(security.verifyPublisherToken(token(), options));
  await assert.rejects(security.verifyVideoRendererToken(token({ workflow_ref: 'jobverify/backend/.github/workflows/social-publisher.yml@refs/heads/main' }, env.SOCIAL_OIDC_AUDIENCE), options));
  for (const patch of [{ repository_id: '1' }, { repository_owner_id: '1' }, { repository: 'fork/backend' }, { ref: 'refs/heads/dev' }, { sub: 'repo:jobverify/backend:pull_request' }, { event_name: 'pull_request' }, { workflow_ref: 'jobverify/backend/.github/workflows/other.yml@refs/heads/main' }]) await assert.rejects(security.verifyVideoRendererToken(token(patch), options));
  await assert.rejects(security.verifyVideoRendererToken(token(), { ...options, env: { ...env, SOCIAL_VIDEO_OIDC_AUDIENCE: env.SOCIAL_OIDC_AUDIENCE } }));
});

test('Instagram prepares Reels with video and cover URLs and requires Reel receipt product type', async () => {
  const requests = []; let product = 'FEED';
  const provider = createSocialProvider({ env, fetch: async (url, options) => { requests.push({ url: String(url), options }); return Response.json(options.method === 'POST' ? { id: '123' } : { id: '123', owner: { id: '2' }, caption: 'caption', media_type: 'VIDEO', media_product_type: product, permalink: 'https://www.instagram.com/reel/123/' }); } });
  const account = { accessToken: security.encryptSocialToken('secret', env.SOCIAL_TOKEN_ENCRYPTION_KEY) };
  const reel = { platform: 'instagram', destination: '2', phase: 'prepare', snapshot: { instagramMediaType: 'reel', caption: 'caption', facts: { title: 'Engineer', company: 'Acme' } } };
  const result = await provider.step(reel, account, { now: new Date(), videoUrl: 'https://api.example/video.mp4', coverUrl: 'https://api.example/cover.jpg' });
  const form = requests[0].options.body;
  assert.equal(form.get('media_type'), 'REELS'); assert.equal(form.get('video_url'), 'https://api.example/video.mp4'); assert.equal(form.get('cover_url'), 'https://api.example/cover.jpg'); assert.equal(form.has('image_url'), false); assert.equal(result.phase, 'poll');
  assert.equal(await provider.receipt(reel, account, '123'), null); product = 'REELS'; assert.equal((await provider.receipt(reel, account, '123')).published, true);
  assert.match(requests.at(-1).url, /media_product_type/);
  requests.length = 0;
  await provider.step({ ...reel, snapshot: { ...reel.snapshot, instagramMediaType: 'image' } }, account, { now: new Date(), imageUrl: 'https://api.example/image.jpg' });
  assert.equal(requests[0].options.body.get('image_url'), 'https://api.example/image.jpg'); assert.equal(requests[0].options.body.has('media_type'), false);
});
