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
import { createSocialPost, setSocialImage, approveSocialPost, editSocialPost, cancelSocialPost, saveSocialSettings, runSocialBatch, maintainSocialPublishing } from '../src/social/service.js';

test('durable social approvals and batch publishing', { timeout: 120_000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const models = [Job, SiteSettings, PipelineRun, AdminAudit, SocialPost, SocialDelivery, SocialAccount, SocialSettings];
  await Promise.all(models.map(model => model.init()));
  const admin = new mongoose.Types.ObjectId(); const clock = new Date('2026-11-20T04:29:00Z');
  const now = new Date('2026-11-20T04:30:00Z'); const slot = now.toISOString();
  let sequence = 0;
  const reset = async () => {
    await Promise.all(models.map(model => model.deleteMany({})));
    await SocialAccount.create(['linkedin', 'instagram'].map((platform, index) => ({ _id: platform, destination: platform === 'linkedin' ? 'urn:li:organization:1' : '2', revision: 1, status: 'ready', accessToken: 'encrypted-test-value', scopes: [], expiresAt: new Date('2027-01-01'), label: `Account ${index}` })));
  };
  const job = overrides => Job.create({ title: `Software Engineer ${++sequence}`, company: 'Example', city: 'Pune', country: 'India', location: 'Pune', jobType: 'Full-time Fresher', experienceRequired: '0 years',
    status: 'active', fingerprint: `social-${sequence}`, description: 'Build and maintain software services. Work with the engineering team to develop, test and support reliable applications for customers.',
    sourceDescription: 'Build and maintain software services. Work with the engineering team to develop, test and support reliable applications for customers.',
    sourceUrl: `https://careers.example/jobs/${sequence}`, sourceAvailability: { state: 'open' }, postedAt: clock, lastSeenAt: clock, ...overrides });
  const draft = async () => {
    const row = await job(); let post = await createSocialPost(String(row._id), admin, { now: clock });
    post = await setSocialImage(String(post._id), post.revision, { hash: 'a'.repeat(64), key: `social/${'a'.repeat(64)}.jpg`, width: 1080, height: 1350, size: 100, type: 'image/jpeg' }, admin);
    return post;
  };
  const approve = (post, platforms) => approveSocialPost(String(post._id), { revision: post.revision, slot, ...(platforms ? { platforms } : {}) }, admin, { now: clock });
  const resume = async (provider, time = now) => {
    let result;
    for (let i = 0; i < 12; i++) {
      result = await runSocialBatch({ batchId: result?.batchId, runId: '123', now: time, provider, assets: { get: async () => ({ arrayBuffer: async () => new Uint8Array([1]).buffer }) } });
      if (result.done) return result;
    }
    assert.fail('Batch did not finish');
  };
  const provider = sent => ({
    step: async delivery => ({ phase: 'publish', providerState: { containerId: `${delivery.platform}-asset` } }),
    publish: async delivery => { sent.push(delivery.platform); return { providerId: `${delivery.platform}-receipt`, permalink: `https://${delivery.platform}.com/p/receipt` }; },
    receipt: async () => ({ published: true }), refresh: async () => null,
  });

  await t.test('approval requires the uploaded image and reserves each platform slot atomically', async () => {
    await reset(); const row = await job(); let post = await createSocialPost(String(row._id), admin, { now: clock });
    await assert.rejects(approve(post), /image/i);
    post = await setSocialImage(String(post._id), post.revision, { hash: 'b'.repeat(64), key: 'social/test.jpg' }, admin);
    await approve(post);
    const other = await draft(); await assert.rejects(approve(other), /slot|reserved/i);
    assert.equal(await SocialDelivery.countDocuments({ post: other._id }), 0);
    assert.equal(await SocialDelivery.countDocuments({ reserved: true }), 2);
    assert.equal((await SocialSettings.findById('global')).paused, true);
    await assert.rejects(editSocialPost(String(post._id), 0, post.captions, admin), /changed|revision/i);
    const current = await SocialPost.findById(post._id).lean();
    const changed = await editSocialPost(String(post._id), current.revision, { ...current.captions, linkedin: 'Edited caption' }, admin);
    assert.equal(changed.approvalHash, null);
    assert.equal(await SocialDelivery.countDocuments({ post: post._id, reserved: true }), 0);
  });

  await t.test('paused, empty and delayed runs do not publish; missed slots are recorded', async () => {
    await reset(); const post = await draft(); await approve(post); const sent = [];
    assert.equal((await runSocialBatch({ runId: '1', now, provider: provider(sent) })).outcome, 'paused');
    await saveSocialSettings({ paused: false, revision: 0 }, admin);
    assert.equal((await runSocialBatch({ runId: '1', now: new Date('2026-11-20T04:46:00Z'), provider: provider(sent) })).outcome, 'missed');
    assert.equal(sent.length, 0); assert.equal(await SocialDelivery.countDocuments({ status: 'missed' }), 2);
  });

  await t.test('concurrent runs and replays publish each approved destination once', async () => {
    await reset(); await approve(await draft()); await job(); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    const sent = []; const impl = provider(sent);
    await Promise.all([runSocialBatch({ runId: '1', now, provider: impl }), runSocialBatch({ runId: '2', now, provider: impl })]);
    await resume(impl); await resume(impl);
    assert.deepEqual(sent.sort(), ['instagram', 'linkedin']);
    assert.equal(await SocialDelivery.countDocuments({ status: 'published' }), 2);
    assert.equal(await SocialPost.countDocuments({}), 1);
  });

  await t.test('a changed job requires review and a hidden job is cancelled before publishing', async () => {
    for (const [changes, expected] of [[{ title: 'Changed role title' }, 'needs_review'], [{ status: 'hidden' }, 'cancelled'], [{ 'sourceAvailability.state': 'closed' }, 'cancelled'], [{ closingDate: new Date('2026-11-19') }, 'cancelled']]) {
      await reset(); const post = await draft(); await approve(post); await saveSocialSettings({ paused: false, revision: 0 }, admin);
      await Job.updateOne({ _id: post.job }, { $set: changes }); const sent = []; await resume(provider(sent));
      assert.equal(sent.length, 0); assert.equal(await SocialDelivery.countDocuments({ status: expected }), 2);
    }
  });

  await t.test('partial success can reschedule just the failed channel without resending LinkedIn', async () => {
    await reset(); const post = await draft(); await approve(post); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    const sent = []; const impl = provider(sent); const publish = impl.publish;
    impl.publish = async delivery => { if (delivery.platform === 'instagram') throw Object.assign(new Error('Rejected'), { rejected: true }); return publish(delivery); };
    await resume(impl); assert.deepEqual(sent, ['linkedin']);
    assert.equal((await SocialPost.findById(post._id)).status, 'needs_review');
    const current = await SocialPost.findById(post._id).lean();
    await approveSocialPost(String(post._id), { revision: current.revision, slot: '2026-11-20T12:30:00Z', platforms: ['instagram'] }, admin, { now });
    await resume(provider(sent), new Date('2026-11-20T12:30:00Z'));
    assert.deepEqual(sent, ['linkedin', 'instagram']);
    assert.equal(await SocialDelivery.countDocuments({ status: 'published' }), 2);
  });

  await t.test('pausing between provider steps prevents a new publish request', async () => {
    await reset(); await approve(await draft(), ['instagram']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    const sent = []; const impl = provider(sent);
    const started = await runSocialBatch({ runId: '1', now, provider: impl });
    await saveSocialSettings({ paused: true, revision: 1 }, admin);
    const stopped = await runSocialBatch({ batchId: started.batchId, now, provider: impl });
    assert.equal(stopped.outcome, 'paused'); assert.equal(stopped.done, true); assert.deepEqual(sent, []);
    await saveSocialSettings({ paused: false, revision: 2 }, admin);
    await runSocialBatch({ batchId: started.batchId, now, provider: impl });
    assert.deepEqual(sent, ['instagram']);
  });

  await t.test('an unselected account change does not invalidate the selected destination', async () => {
    await reset(); await approve(await draft(), ['linkedin']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    await SocialAccount.updateOne({ _id: 'instagram' }, { $inc: { revision: 1 } });
    const sent = []; await resume(provider(sent)); assert.deepEqual(sent, ['linkedin']);
  });

  for (const retryAfterMs of [1000, 30_000]) await t.test(`failed Instagram polls count toward five checks and wait a minute (${retryAfterMs}ms retry hint)`, async () => {
    await reset(); await approve(await draft(), ['instagram']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    let polls = 0; const impl = provider([]);
    impl.step = async row => {
      if (row.phase === 'prepare') return { phase: 'poll', providerState: { containerId: 'container', polls: 0 }, nextPollAt: new Date(now.getTime() + 60_000) };
      polls++; throw Object.assign(new Error('Temporary poll failure'), { retryable: true, retryAfterMs });
    };
    const started = await runSocialBatch({ now, provider: impl });
    for (let minute = 1; minute <= 5; minute++) {
      const time = new Date(now.getTime() + minute * 60_000);
      await runSocialBatch({ batchId: started.batchId, now: time, provider: impl });
      await runSocialBatch({ batchId: started.batchId, now: new Date(time.getTime() + 59_000), provider: impl });
      assert.equal(polls, minute);
      assert.equal((await SocialDelivery.findOne().select('+providerState')).providerState.polls, minute);
    }
    assert.equal((await SocialDelivery.findOne()).status, 'failed');
  });

  await t.test('an expired Instagram token blocks that destination while LinkedIn still publishes', async () => {
    await reset(); await approve(await draft()); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    await SocialAccount.updateOne({ _id: 'instagram' }, { $set: { expiresAt: new Date('2026-11-20T04:29:59Z') } });
    const sent = []; await resume(provider(sent));
    assert.deepEqual(sent, ['linkedin']);
    assert.equal((await SocialDelivery.findOne({ platform: 'instagram' })).status, 'failed');
    assert.equal((await SocialDelivery.findOne({ platform: 'linkedin' })).status, 'published');
  });

  await t.test('a bounded publish already in flight retains its lease and authoritative receipt at the deadline', async () => {
    await reset(); await approve(await draft(), ['instagram']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    const sent = []; const impl = provider(sent); const publish = impl.publish;
    const started = await runSocialBatch({ runId: '1', now, provider: impl });
    impl.publish = async row => {
      await maintainSocialPublishing({ now: new Date('2026-11-20T04:40:01Z'), provider: impl });
      assert.equal((await SocialDelivery.findById(row._id)).status, 'submitted');
      return publish(row);
    };
    await runSocialBatch({ batchId: started.batchId, runId: '1', now: new Date('2026-11-20T04:39:55Z'), provider: impl });
    const receipt = await SocialDelivery.findOne().lean();
    assert.equal(receipt.status, 'published'); assert.equal(receipt.providerId, 'instagram-receipt'); assert.equal(sent.length, 1);
  });

  await t.test('ambiguous sends are quarantined and maintenance never publishes', async () => {
    await reset(); await approve(await draft(), ['instagram']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    let publishes = 0; const impl = provider([]); impl.publish = async () => { publishes++; throw new Error('Connection lost after send'); };
    await resume(impl); await resume(impl);
    await maintainSocialPublishing({ now: new Date('2026-11-20T04:50:00Z'), provider: impl });
    assert.equal(publishes, 1); assert.equal(await SocialDelivery.countDocuments({ status: 'uncertain' }), 1);
  });

  await t.test('processing can finish after the slot grace but cannot exceed its batch deadline', async () => {
    await reset(); await approve(await draft(), ['instagram']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    const sent = []; const impl = provider(sent);
    const first = await runSocialBatch({ runId: '1', now: new Date('2026-11-20T04:44:00Z'), provider: impl });
    const finished = await runSocialBatch({ batchId: first.batchId, runId: '1', now: new Date('2026-11-20T04:46:00Z'), provider: impl });
    assert.equal(finished.done, true); assert.equal(sent.length, 1);
    await reset(); await approve(await draft(), ['instagram']); await saveSocialSettings({ paused: false, revision: 0 }, admin);
    const waiting = { ...impl, step: async () => ({ phase: 'poll', nextPollAt: new Date('2026-11-20T04:55:00Z') }) };
    const started = await runSocialBatch({ runId: '1', now, provider: waiting });
    await runSocialBatch({ batchId: started.batchId, runId: '1', now: new Date('2026-11-20T04:41:00Z'), provider: waiting });
    assert.equal((await SocialDelivery.findOne()).status, 'failed');
    const current = await SocialPost.findOne().lean(); await cancelSocialPost(String(current._id), current.revision, admin);
  });
});
