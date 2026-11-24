import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createCanvas } from '@napi-rs/canvas';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import SocialPost from '../src/models/SocialPost.js';
import SocialDelivery from '../src/models/SocialDelivery.js';
import SocialAccount from '../src/models/SocialAccount.js';
import SocialSettings from '../src/models/SocialSettings.js';
import AdminAudit from '../src/models/AdminAudit.js';
Object.assign(process.env, { JWT_SECRET: 'video-http-fixture-secret-at-least-32-characters', NODE_ENV: 'test', CORS_ORIGIN: 'http://localhost:5173', SOCIAL_GITHUB_REPOSITORY_ID: '123', SOCIAL_GITHUB_OWNER_ID: '456', SOCIAL_GITHUB_REPOSITORY: 'jobverify/backend', SOCIAL_OIDC_AUDIENCE: 'https://api.jobverify.in/api/social-publisher/run', SOCIAL_VIDEO_OIDC_AUDIENCE: 'https://api.jobverify.in/api/social-video-drafts' });
const { createApp } = await import('../src/app.js');

test('renderer uploads, private previews and public range streaming use separate authentication boundaries', { timeout: 90_000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri()); await Promise.all([User, Job, SocialPost, SocialDelivery, SocialAccount, SocialSettings, AdminAudit].map(model => model.init()));
  const admin = await User.create({ email: 'reel-admin@example.test', role: 'admin', isVerified: true });
  const member = await User.create({ email: 'reel-member@example.test', isVerified: true });
  const objects = new Map(); let bufferedReads = 0; let puts = 0;
  const assets = { put: async (key, bytes) => { puts++; objects.set(key, Buffer.from(bytes)); }, get: async (key, options = {}) => {
    const bytes = objects.get(key); if (!bytes) return null;
    const range = options.range; const data = range ? bytes.subarray(range.offset, range.offset + range.length) : bytes;
    return { size: bytes.length, body: new ReadableStream({ start(c) { c.enqueue(data); c.close(); } }), arrayBuffer: async () => { bufferedReads++; throw new Error('Whole movie reads are forbidden'); } };
  } };
  const server = createApp({ socialAssets: assets }).listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch; const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'reel-http', alg: 'RS256', use: 'sig' };
  globalThis.fetch = (url, options) => String(url).startsWith('https://token.actions.githubusercontent.com/') ? Promise.resolve(Response.json({ keys: [jwk] })) : originalFetch(url, options);
  t.after(() => { globalThis.fetch = originalFetch; });
  const identity = (renderer = true) => jwt.sign({ repository_id: '123', repository_owner_id: '456', repository: 'jobverify/backend', ref: 'refs/heads/main', workflow_ref: `jobverify/backend/.github/workflows/${renderer ? 'social-video-drafts' : 'social-publisher'}.yml@refs/heads/main`, event_name: 'workflow_dispatch', sub: 'repo:jobverify/backend:ref:refs/heads/main', run_id: '987' }, privateKey, { algorithm: 'RS256', keyid: jwk.kid, issuer: 'https://token.actions.githubusercontent.com', audience: renderer ? process.env.SOCIAL_VIDEO_OIDC_AUDIENCE : process.env.SOCIAL_OIDC_AUDIENCE, expiresIn: 300 });
  const request = async (path, { user = admin, method = 'GET', body, bearer, headers = {} } = {}) => {
    const response = await originalFetch(base + path, { method, headers: { origin: 'http://localhost:5173', 'x-csrf-token': 'fixture', cookie: `jobverify_csrf=fixture;${user ? `jobverify_token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}` : ''}`, 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }) });
    return { response, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()) };
  };
  assert.equal((await request('/api/social-video-drafts/claim', { method: 'POST', body: {} })).response.status, 401);
  assert.equal((await request('/api/social-video-drafts/claim', { method: 'POST', body: {}, bearer: identity(false) })).response.status, 401);
  const defaults = await request('/api/admin/social-settings'); assert.equal(defaults.data.data.instagramDrafts.enabled, false);
  await request('/api/admin/social-settings', { method: 'PUT', body: { revision: 0, instagramDrafts: { enabled: true, matchAll: true, filters: {} } } });
  await Job.create({ title: 'Engineer', company: 'Acme', city: 'Pune', country: 'India', jobType: 'Full-time Fresher', status: 'active', fingerprint: 'reel-http', sourceUrl: 'https://careers.example/1', description: 'Build and maintain software services. Work with the engineering team to develop, test and support reliable applications for customers.', sourceDescription: 'Build and maintain software services. Work with the engineering team to develop, test and support reliable applications for customers.' });
  const claimed = await request('/api/social-video-drafts/claim', { method: 'POST', body: {}, bearer: identity() }); assert.equal(claimed.response.status, 200);
  const claim = claimed.data.data.claim; assert.ok(claim);
  const machine = { bearer: identity() }; const headers = { 'x-social-render-id': claim.renderId, 'x-social-lease': claim.leaseToken, 'x-social-revision': String(claim.revision) };
  const path = kind => `/api/social-video-drafts/${claim.postId}/assets/${kind}`;
  const invalid = await request(path('video'), { ...machine, method: 'PUT', body: Buffer.from('forged movie'), headers: { ...headers, 'content-type': 'video/mp4' } }); assert.equal(invalid.response.status, 400); assert.equal(puts, 0);
  const movie = await readFile(new URL('./test-data/social-reel.mp4', import.meta.url)); const cover = createCanvas(1080, 1920).toBuffer('image/jpeg');
  const files = { video: [movie, 'video/mp4'], cover: [cover, 'image/jpeg'], subtitles: [Buffer.from('1\n00:00:00,000 --> 00:00:03,000\nJobs link in bio.\n'), 'application/x-subrip'] }; const hashes = {};
  for (const [kind, [bytes, type]] of Object.entries(files)) {
    const uploaded = await request(path(kind), { ...machine, method: 'PUT', body: bytes, headers: { ...headers, 'content-type': type } }); assert.equal(uploaded.response.status, 200, JSON.stringify(uploaded.data)); hashes[kind] = uploaded.data.data.hash;
  }
  assert.equal((await request(path('cover'), { ...machine, method: 'PUT', body: cover, headers: { ...headers, 'x-social-lease': 'stale', 'content-type': 'image/jpeg' } })).response.status, 409);
  const details = (await request(`/api/admin/social-posts/${claim.postId}`)).data.data; assert.equal(details.generation.leaseToken, undefined); assert.equal(details.generation.uploads, undefined);
  const completed = await request('/api/social-video-drafts/complete', { ...machine, method: 'POST', body: { ...claim, artifacts: hashes, versions: { ffmpeg: 'fixture-9.0.2' } } }); assert.equal(completed.response.status, 200, JSON.stringify(completed.data));
  const previewPath = `/api/admin/social-posts/${claim.postId}/video/video`;
  assert.equal((await request(previewPath, { user: null })).response.status, 401); assert.equal((await request(previewPath, { user: member })).response.status, 403);
  assert.equal((await request(`/api/social-assets/${hashes.video}.mp4`, { user: null })).response.status, 404);
  const preview = await request(previewPath); assert.deepEqual(preview.data, movie); assert.equal(preview.response.headers.get('accept-ranges'), 'bytes');
  const head = await request(previewPath, { method: 'HEAD' }); assert.equal(head.response.headers.get('content-length'), String(movie.length)); assert.equal(head.data.length, 0);
  for (const [range, expected] of [['bytes=10-19', movie.subarray(10, 20)], ['bytes=-10', movie.subarray(-10)], ['bytes=10-', movie.subarray(10)]]) {
    const partial = await request(previewPath, { headers: { range } }); assert.equal(partial.response.status, 206); assert.deepEqual(partial.data, expected); assert.match(partial.response.headers.get('content-range'), /^bytes /);
  }
  assert.equal((await request(previewPath, { headers: { range: 'bytes=999999999-' } })).response.status, 416);
  assert.equal((await request(`/api/social-assets/${hashes.subtitles}.srt`, { user: null })).response.status, 404);
  await SocialAccount.create({ _id: 'instagram', destination: '2', status: 'ready', revision: 1, expiresAt: new Date(Date.now() + 60 * 86400_000) });
  const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); tomorrow.setUTCHours(4, 30, 0, 0);
  const approved = await request(`/api/admin/social-posts/${claim.postId}/approve`, { method: 'POST', body: { revision: completed.data.data.revision, platforms: ['instagram'], slot: tomorrow.toISOString() } }); assert.equal(approved.response.status, 200, JSON.stringify(approved.data));
  const publicMovie = await request(`/api/social-assets/${hashes.video}.mp4`, { user: null, headers: { range: 'bytes=0-31' } }); assert.equal(publicMovie.response.status, 206); assert.deepEqual(publicMovie.data, movie.subarray(0, 32)); assert.match(publicMovie.response.headers.get('cache-control'), /immutable/);
  assert.equal((await request(`/api/social-assets/${hashes.cover}.jpg`, { user: null })).response.status, 200);
  assert.equal(bufferedReads, 0);
});
