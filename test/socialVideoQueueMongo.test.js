import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import SiteSettings from '../src/models/SiteSettings.js';
import PipelineRun from '../src/models/PipelineRun.js';
import AdminAudit from '../src/models/AdminAudit.js';
import SocialPost from '../src/models/SocialPost.js';
import SocialDelivery from '../src/models/SocialDelivery.js';
import SocialAccount from '../src/models/SocialAccount.js';
import SocialSettings from '../src/models/SocialSettings.js';
import { saveSocialSettings, createSocialPost, cancelSocialPost, refreshSocialPost, approveSocialPost, editSocialPost, setSocialImage, runSocialBatch } from '../src/social/service.js';
import { createSocialProvider } from '../src/social/providers.js';
import { encryptSocialToken } from '../src/social/security.js';
import * as video from '../src/social/videoService.js';

test('automatic Reel queue is fenced, filter-aware and separate from publication', { timeout: 120_000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const models = [Job, SiteSettings, PipelineRun, AdminAudit, SocialPost, SocialDelivery, SocialAccount, SocialSettings];
  await Promise.all(models.map(model => model.init()));
  const admin = new mongoose.Types.ObjectId(); const now = new Date('2026-11-20T04:00:00Z'); let seq = 0;
  const reset = async () => { await Promise.all(models.map(model => model.deleteMany({}))); };
  const job = overrides => Job.create({ title: `Engineer ${++seq}`, company: 'Acme', city: 'Pune', country: 'India', location: 'Pune', jobType: 'Full-time Fresher', experienceRequired: '0 years', status: 'active', fingerprint: `video-${seq}`, description: 'Build and maintain software services. Work with the engineering team to develop, test and support reliable applications for customers.', sourceDescription: 'Build and maintain software services. Work with the engineering team to develop, test and support reliable applications for customers.', sourceUrl: `https://careers.example/jobs/${seq}`, sourceAvailability: { state: 'open' }, postedAt: now, lastSeenAt: now, ...overrides });
  const enable = (filters = {}, matchAll = true) => saveSocialSettings({ revision: 0, instagramDrafts: { enabled: true, matchAll, filters } }, admin);
  const claim = (runId = '1', time = now) => video.claimVideoDraft({ runId, now: time });

  await t.test('renderer receives the job employer domain in its immutable plan', async () => {
    await reset(); await enable(); await job({ company: 'Microsoft', companyDomain: 'microsoft.com' });
    const { claim: current } = await claim();
    assert.equal(current.plan.companyDomain, 'microsoft.com');
    assert.equal(current.plan.templateVersion, 'jobverify-reel-v6');
    const stored = await SocialPost.findById(current.postId).lean();
    assert.equal(stored.generation.plan.companyDomain, 'microsoft.com');
  });

  await t.test('settings updates preserve pause and generation switches independently with parent revision', async () => {
    await reset(); const settings = await enable();
    assert.equal(settings.paused, true); assert.equal(settings.instagramDrafts.enabled, true);
    const paused = await saveSocialSettings({ revision: 1, paused: false }, admin);
    assert.equal(paused.instagramDrafts.enabled, true);
    await assert.rejects(saveSocialSettings({ revision: 0, paused: true }, admin), /changed/i);
    await saveSocialSettings({ revision: 2, instagramDrafts: { enabled: false } }, admin);
    assert.equal((await video.claimVideoDraft({ runId: '1', now })).done, true);
  });
  await t.test('filters find candidates beyond forty, skip existing campaigns and refill only four matching reservations', async () => {
    await reset(); await enable({ company: ['Target'] }, false);
    const wanted = await Promise.all(Array.from({ length: 6 }, (_, i) => job({ company: 'Target', createdAt: new Date(now.getTime() - 100_000 - i) })));
    await Promise.all(Array.from({ length: 45 }, (_, i) => job({ company: 'Other', createdAt: new Date(now.getTime() + i) })));
    await createSocialPost(String(wanted[0]._id), admin, { now });
    const results = await Promise.all([claim('1'), claim('2'), claim('3'), claim('4'), claim('5')]);
    const claims = results.filter(r => !r.done).map(r => r.claim);
    assert.equal(claims.length, 4); assert.equal(new Set(claims.map(c => c.postId)).size, 4);
    assert.ok(claims.every(c => c.facts.company === 'Target'));
    assert.equal(await SocialDelivery.countDocuments(), 0);
    const row = await SocialPost.findById(claims[0].postId).lean();
    assert.equal(row.origin, 'instagram_auto'); assert.equal(row.instagramMediaType, 'reel'); assert.equal(row.approvalHash, null);
    assert.equal(video.publicVideoPost(row).generation.leaseToken, undefined);
    assert.equal(video.publicVideoPost(row).generation.uploads, undefined);
  });
  await t.test('one workflow claims at most two jobs and a retry cannot exceed four active reservations', async () => {
    await reset(); await enable(); for (let i = 0; i < 6; i++) await job();
    const a = (await claim('1')).claim; await claim('1'); assert.equal((await claim('1')).reason, 'run_limit');
    await claim('2'); await claim('2');
    await video.failVideoDraft({ ...a, reason: 'render_failed', retryable: true }, { now });
    await claim('3');
    assert.equal((await claim('4', new Date(+now + 6 * 60_000))).done, true);
    assert.equal(await SocialPost.countDocuments({ 'generation.state': 'rendering' }), 4);
  });
  await t.test('classification-in-progress, hidden, closed and expired jobs produce no claim', async () => {
    await reset(); await enable(); await job();
    await PipelineRun.create({ _id: 'video-classification', origin: 'github', target: 'github', stages: [{ key: 'classification', status: 'running' }] });
    assert.equal((await claim()).reason, 'classification_not_ready'); await reset(); await enable();
    for (const overrides of [{ status: 'hidden' }, { sourceAvailability: { state: 'closed' } }, { closingDate: new Date(+now - 1) }]) await job(overrides);
    assert.equal((await claim()).done, true); assert.equal(await SocialPost.countDocuments(), 0);
  });
  await t.test('leases renew, expire and reject stale workers, cancellation and source refresh', async () => {
    await reset(); await enable(); await job(); const first = (await claim()).claim;
    const renewed = await video.heartbeatVideoDraft(first, { now: new Date(+now + 60_000) }); assert.ok(new Date(renewed.leaseUntil) > new Date(first.leaseUntil));
    const second = (await claim('2', new Date(+now + 12 * 60_000))).claim;
    assert.equal(second.postId, first.postId); assert.notEqual(second.leaseToken, first.leaseToken);
    await assert.rejects(video.heartbeatVideoDraft(first, { now: new Date(+now + 12 * 60_000) }), /lease|stale/i);
    const post = await SocialPost.findById(second.postId);
    const refreshed = await refreshSocialPost(second.postId, post.revision, admin, { now });
    assert.equal(refreshed.video, null); assert.equal(refreshed.generation.state, 'queued');
    await assert.rejects(video.heartbeatVideoDraft(second, { now }), /lease|stale/i);
    const third = (await claim('3')).claim; const current = await SocialPost.findById(third.postId);
    await cancelSocialPost(third.postId, current.revision, admin);
    await assert.rejects(video.heartbeatVideoDraft(third, { now }), /lease|stale/i);
  });
  await t.test('transient failures back off with three attempts and explicit retry keeps one campaign', async () => {
    await reset(); await enable(); await job(); let time = now; let c;
    for (let attempt = 1; attempt <= 3; attempt++) {
      c = (await claim(String(attempt), time)).claim; assert.ok(c);
      await video.failVideoDraft({ ...c, reason: 'render_failed', retryable: true }, { now: time });
      assert.equal((await claim(String(100 + attempt), time)).done, true);
      time = new Date(+time + 24 * 3600_000);
    }
    assert.equal((await claim('4', time)).done, true);
    let post = await SocialPost.findById(c.postId).lean(); assert.equal(post.generation.attempts, 3);
    post = await video.retryVideoDraft(c.postId, post.revision, admin, { now });
    assert.equal(post.generation.state, 'queued'); assert.equal(await SocialPost.countDocuments(), 1);
  });
  await t.test('complete requires current upload records and facts; identical completion is idempotent', async () => {
    await reset(); await enable(); const source = await job(); const c = (await claim()).claim;
    const hashes = { video: 'a'.repeat(64), cover: 'b'.repeat(64), subtitles: 'c'.repeat(64) };
    const result = { ...c, artifacts: hashes, versions: { ffmpeg: 'fixture' } };
    await assert.rejects(video.completeVideoDraft(result, { now }), /artifact|upload/i);
    const uploads = Object.fromEntries(Object.entries(hashes).map(([kind, hash]) => [kind, { hash, key: `social/${hash}.${kind}`, type: kind, size: 100 }]));
    await SocialPost.updateOne({ _id: c.postId }, { $set: { 'generation.uploads': uploads } });
    await Job.updateOne({ _id: source._id }, { $set: { title: 'Changed role' } });
    await assert.rejects(video.completeVideoDraft(result, { now }), /facts|changed/i);
    await Job.updateOne({ _id: source._id }, { $set: { title: c.facts.title } });
    await Job.updateOne({ _id: source._id }, { $set: { companyDomain: 'different-employer.com' } });
    await assert.rejects(video.completeVideoDraft(result, { now }), /branding|changed/i);
    await Job.updateOne({ _id: source._id }, { $set: { companyDomain: null } });
    const completed = await video.completeVideoDraft(result, { now }); assert.equal(completed.generation.state, 'ready'); assert.equal((await SocialSettings.findById('global')).instagramDrafts.lastRunOutcome, 'ready');
    assert.equal((await video.completeVideoDraft(result, { now })).video.mp4.hash, hashes.video);
    await assert.rejects(video.completeVideoDraft({ ...result, artifacts: { ...hashes, video: 'd'.repeat(64) } }, { now }), /lease|result|completion/i);
    await SocialAccount.create({ _id: 'instagram', destination: '2', status: 'ready', revision: 1, expiresAt: new Date('2027-01-01') });
    const approved = await approveSocialPost(c.postId, { revision: completed.revision, platforms: ['instagram'], slot: '2026-11-20T04:30:00Z' }, admin, { now });
    assert.ok(approved.approvalHash); assert.equal((await SocialDelivery.findOne()).snapshot.instagramMediaType, 'reel');
    const edited = await editSocialPost(c.postId, approved.revision, { ...approved.captions, instagram: 'Changed caption' }, admin); assert.equal(edited.approvalHash, null);
  });
  await t.test('editing or uploading an image during rendering fences completion and never exceeds three attempts', async () => {
    await reset(); await enable(); await job(); let c;
    for (let attempt = 1; attempt <= 3; attempt++) {
      c = (await claim(String(attempt))).claim;
      const post = await SocialPost.findById(c.postId).lean();
      if (attempt === 2) await setSocialImage(c.postId, post.revision, { hash: 'e'.repeat(64) }, admin);
      else await editSocialPost(c.postId, post.revision, { ...post.captions, instagram: `Caption ${attempt}` }, admin);
      await assert.rejects(video.heartbeatVideoDraft(c, { now }), /lease|stale/i);
    }
    assert.equal((await claim('4')).done, true);
    const post = await SocialPost.findById(c.postId).lean(); assert.equal(post.generation.state, 'failed');
  });
  await t.test('an unverified Reel publication keeps its provider ID and never sends again', async () => {
    await reset(); await enable(); await job(); const c = (await claim()).claim;
    const videoPackage = { mp4: { hash: 'a'.repeat(64) }, cover: { hash: 'b'.repeat(64) }, subtitles: { hash: 'c'.repeat(64) }, factsHash: c.factsHash, planHash: c.planHash };
    await SocialPost.updateOne({ _id: c.postId }, { $set: { video: videoPackage, 'generation.state': 'ready' } });
    await SocialAccount.create({ _id: 'instagram', destination: '2', status: 'ready', revision: 1, expiresAt: new Date('2027-01-01') });
    await approveSocialPost(c.postId, { revision: c.revision, platforms: ['instagram'], slot: '2026-11-20T04:30:00Z' }, admin, { now });
    await saveSocialSettings({ revision: 1, paused: false }, admin);
    let publishes = 0; let receipts = 0;
    const provider = { step: async (_delivery, _account, options) => { assert.match(options.videoUrl, /\.mp4$/); assert.match(options.coverUrl, /\.jpg$/); return { phase: 'publish' }; }, publish: async () => { publishes++; return { providerId: '123' }; }, receipt: async () => { receipts++; return null; } };
    const clock = new Date('2026-11-20T04:30:00Z'); const first = await runSocialBatch({ now: clock, provider });
    await runSocialBatch({ batchId: first.batchId, now: clock, provider });
    await runSocialBatch({ batchId: first.batchId, now: clock, provider });
    const delivery = await SocialDelivery.findOne().lean(); assert.equal(delivery.status, 'uncertain'); assert.equal(delivery.providerId, '123'); assert.equal(publishes, 1); assert.equal(receipts, 1);
  });

  for (const status of [429, 400, 401]) await t.test(`receipt HTTP ${status} after accepted Reel publication remains uncertain and cannot resend or reapprove`, async () => {
    await reset(); await enable(); await job(); const c = (await claim()).claim;
    await SocialPost.updateOne({ _id: c.postId }, { $set: { video: { mp4: { hash: 'a'.repeat(64) }, cover: { hash: 'b'.repeat(64) }, subtitles: { hash: 'c'.repeat(64) }, factsHash: c.factsHash, planHash: c.planHash }, 'generation.state': 'ready' } });
    const key = Buffer.alloc(32, 1).toString('base64');
    await SocialAccount.create({ _id: 'instagram', destination: '2', status: 'ready', accessToken: encryptSocialToken('fixture', key), revision: 1, expiresAt: new Date('2027-01-01') });
    await approveSocialPost(c.postId, { revision: c.revision, platforms: ['instagram'], slot: '2026-11-20T04:30:00Z' }, admin, { now });
    await saveSocialSettings({ revision: 1, paused: false }, admin);
    let publishes = 0; let reads = 0;
    const actual = createSocialProvider({ env: { SOCIAL_TOKEN_ENCRYPTION_KEY: key }, fetch: async (_url, options) => {
      if (options.method === 'POST') { publishes++; return Response.json({ id: '123' }); }
      reads++; return Response.json({ error: { code: status === 429 ? 4 : status === 401 ? 190 : 100 } }, { status });
    } });
    const provider = { ...actual, step: async () => ({ phase: 'publish', providerState: { containerId: 'container' } }) };
    const clock = new Date('2026-11-20T04:30:00Z'); const first = await runSocialBatch({ now: clock, provider });
    await runSocialBatch({ batchId: first.batchId, now: clock, provider });
    await runSocialBatch({ batchId: first.batchId, now: new Date(+clock + 31_000), provider });
    const delivery = await SocialDelivery.findOne().lean();
    assert.equal(delivery.status, 'uncertain'); assert.equal(delivery.providerId, '123'); assert.equal(delivery.reserved, true); assert.ok(delivery.publishStartedAt);
    assert.equal(publishes, 1); assert.equal(reads, 1);
    const post = await SocialPost.findById(c.postId).lean();
    await assert.rejects(approveSocialPost(c.postId, { revision: post.revision, platforms: ['instagram'], slot: '2026-11-20T12:30:00Z' }, admin, { now: clock }), /uncertain|in-flight/i);
    assert.equal(await SocialDelivery.countDocuments(), 1); assert.equal(publishes, 1);
  });

});
