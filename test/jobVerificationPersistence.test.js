import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
const serviceModule = await import('../src/jobVerification/service.js').catch(() => ({}));
const owner = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';

test('private verification persistence, queue leases and account limits', { timeout: 90_000 }, async t => {
  assert.equal(typeof serviceModule.createVerificationService, 'function');
  const mongo = await MongoMemoryServer.create({ binary: { systemBinary: path.resolve('.cache/mongodb-binaries/mongod-x64-win32-8.2.6.exe'), version: '8.2.6', runtimeDownload: false }, instance: { ip: '127.0.0.1' } });
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'verification-test-only' });
    const { default: Report } = await import('../src/models/JobVerification.js');
    const { default: Lease } = await import('../src/models/JobVerificationLease.js');
    const { default: User } = await import('../src/models/User.js');
    const ownerIds = [owner, other, '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014', ...Array.from({ length: 101 }, (_, index) => (index + 100).toString(16).padStart(24, '0')), '000000000000000000000200'];
    await User.collection.insertMany(ownerIds.map((value, index) => ({ _id: new mongoose.Types.ObjectId(value), email: `verification-${index}@example.test` })));
    await Promise.all([Report.init(), Lease.init()]);
    const engine = async (input, { onProgress }) => {
      const report = { status: 'completed', phase: 'completed', verdict: 'inconclusive', sourceStatus: 'unconfirmed', availability: 'unknown', submittedUrl: input.url, evidence: [], reasons: [], completedPhases: [] };
      await onProgress(report); return report;
    };
    const service = serviceModule.createVerificationService({ enabled: () => true, engine, prepareSources: async () => {} });

    await t.test('concurrent submissions allow only one active investigation per account', async () => {
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => service.submit(owner, { url: 'https://example.com/jobs/1' })));
      assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
      assert.ok(results.filter(item => item.status === 'rejected').every(item => item.reason.status === 409));
      await service.tick();
    });
    await t.test('history and report reads never disclose another account or expired report', async () => {
      const { items } = await service.list(owner);
      assert.equal(items.length, 1);
      assert.equal((await service.list(other)).items.length, 0);
      await assert.rejects(service.get(other, items[0].id), { status: 404 });
      await assert.rejects(service.remove(other, items[0].id), { status: 404 });
      await Report.updateOne({ _id: items[0].id }, { $set: { expiresAt: new Date(0) } });
      await assert.rejects(service.get(owner, items[0].id), { status: 404 });
      assert.equal((await service.list(owner)).items.length, 0);
    });
    await t.test('submission and the durable worker preserve a slash-significant request URL', async () => {
      const submittedUrl = 'https://example.com/jobs/slash-significant/';
      const item = await service.submit(other, { url: submittedUrl });
      assert.equal(item.submittedUrl, submittedUrl);
      await service.tick();
      const saved = await Report.findById(item.id).lean();
      assert.equal(saved.input.url, submittedUrl);
      assert.equal(saved.report.submittedUrl, submittedUrl);
    });
    await t.test('twenty new checks are allowed and a twenty-first is refused', async () => {
      await Report.deleteMany({});
      const { default: Bucket } = await import('../src/models/RateLimitBucket.js');
      await Bucket.deleteMany({});
      for (let index = 0; index < 20; index++) {
        const item = await service.submit(owner, { url: `https://example.com/jobs/${index}` });
        await service.tick();
        assert.equal((await service.get(owner, item.id)).status, 'completed');
      }
      await assert.rejects(service.submit(owner, { url: 'https://example.com/jobs/21' }), { status: 429 });
    });
    await t.test('disabled submissions fail before creating work but existing reports remain private and readable', async () => {
      const off = serviceModule.createVerificationService({ enabled: () => false });
      const before = await Report.countDocuments();
      await assert.rejects(off.submit(other, { url: 'https://example.com/jobs/1' }), { status: 503 });
      assert.equal(await Report.countDocuments(), before);
      assert.ok((await off.list(owner)).items.length > 0);
    });
    await t.test('separate service instances respect the same two global worker slots', async () => {
      await Report.deleteMany({});
      let finish;
      const gate = new Promise(resolve => { finish = resolve; });
      let running = 0, maximum = 0;
      const slow = async input => {
        running++; maximum = Math.max(maximum, running); await gate; running--;
        return { status: 'completed', phase: 'completed', verdict: 'inconclusive', evidence: [], submittedUrl: input.url };
      };
      const left = serviceModule.createVerificationService({ enabled: () => true, engine: slow, prepareSources: async () => {} });
      const right = serviceModule.createVerificationService({ enabled: () => true, engine: slow, prepareSources: async () => {} });
      for (const id of [other, '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']) await left.submit(id, { url: 'https://example.com/jobs/1' });
      const work = Promise.all([left.tick(), right.tick()]);
      for (let attempts = 0; attempts < 100 && running < 2; attempts++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(running, 2); finish(); await work;
      assert.equal(maximum, 2);
      assert.equal(await Report.countDocuments({ status: 'queued' }), 1);
      await left.tick();
    });
    await t.test('a stale worker lease retains partial evidence and releases the active-account constraint', async () => {
      await Report.deleteMany({});
      const item = await service.submit(other, { url: 'https://example.com/jobs/1' });
      await Report.updateOne({ _id: item.id }, { $set: { status: 'running', leaseUntil: new Date(0), runToken: 'stale', report: { evidence: [{ id: 'destination', status: 'completed', detail: 'The destination responded.' }] } } });
      await service.tick();
      const recovered = await service.get(other, item.id);
      assert.equal(recovered.status, 'completed');
      assert.equal(recovered.verdict, 'inconclusive');
      assert.equal(recovered.evidence[0].id, 'destination');
      await service.submit(other, { url: 'https://example.com/jobs/2' });
      await service.tick();
    });
    await t.test('the wall-clock deadline finishes even a stuck check and preserves completed evidence', async () => {
      await Report.deleteMany({});
      const bounded = serviceModule.createVerificationService({ enabled: () => true, prepareSources: async () => {}, deadlineMs: 60,
        engine: async (input, { onProgress }) => {
          await onProgress({ phase: 'employer', sourceStatus: 'unconfirmed', availability: 'unknown', evidence: [{ id: 'destination', title: 'Destination', detail: 'A public page responded.', status: 'completed', outcome: 'neutral', sourceUrl: input.url, observedAt: new Date().toISOString() }] });
          await new Promise(() => {});
        } });
      const item = await bounded.submit(other, { url: 'https://example.com/jobs/deadline' });
      await bounded.tick();
      const finished = await bounded.get(other, item.id);
      assert.equal(finished.status, 'completed');
      assert.equal(finished.verdict, 'inconclusive');
      assert.ok(finished.evidence.some(value => value.id === 'destination'));
      assert.ok(finished.evidence.some(value => value.id === 'deadline' && value.status === 'unavailable'));
    });
    await t.test('canonical identity backfill is repeatable and preserves original source fields', async () => {
      const { default: Job } = await import('../src/models/Job.js');
      const { backfillVerificationKeys } = await import('../src/jobVerification/repository.js');
      const sourceUrl = 'https://boards.greenhouse.io/acme/jobs/123?utm_source=email';
      await Job.collection.insertOne({ title: 'Frontend Engineer', company: 'Acme', sourceUrl, jobId: '123', requisitionId: '123' });
      const preview = await backfillVerificationKeys({ dryRun: true });
      assert.equal(preview.updated, 1);
      await backfillVerificationKeys();
      assert.equal((await backfillVerificationKeys()).updated, 0);
      const row = await Job.findOne({ jobId: '123' }).lean();
      assert.equal(row.sourceUrl, sourceUrl);
      assert.ok(row.verificationKeys.includes('role:greenhouse:global:acme:123'));
    });
    await t.test('an exact role is not crowded out by forty other roles from the same ATS tenant', async () => {
      const { default: Job } = await import('../src/models/Job.js');
      const { findVerificationCandidates } = await import('../src/jobVerification/repository.js');
      const { verificationKeys } = await import('../src/jobVerification/urls.js');
      const records = Array.from({ length: 45 }, (_, index) => ({ title: `Engineer ${index}`, company: 'Acme', sourceUrl: `https://jobs.lever.co/acme/role-${index}`, jobId: `role-${index}` }));
      await Job.collection.insertMany(records.map(row => ({ ...row, fingerprint: row.sourceUrl, verificationKeys: verificationKeys(row) })));
      const candidates = await findVerificationCandidates({ urls: [records.at(-1).sourceUrl] });
      assert.equal(candidates[0].sourceUrl, records.at(-1).sourceUrl);
      assert.ok(candidates.length <= 40);
    });
    await t.test('the durable queue refuses a hundred-and-first pending investigation', async () => {
      await Report.deleteMany({});
      const queued = serviceModule.createVerificationService({ enabled: () => true, engine });
      for (let index = 100; index < 200; index++) await queued.submit(index.toString(16).padStart(24, '0'), { url: 'https://example.com/jobs/1' });
      await assert.rejects(queued.submit('000000000000000000000200', { url: 'https://example.com/jobs/1' }), { status: 503 });
      assert.equal(await Report.countDocuments({ status: 'queued' }), 100);
    });
    await t.test('account deletion removes the owner’s private verification evidence', async () => {
      const { default: User } = await import('../src/models/User.js');
      const { removeUserAccount } = await import('../src/services/userAccountDeletion.js');
      const user = { _id: new mongoose.Types.ObjectId(owner), email: 'verification-deletion@example.test' };
      await User.collection.updateOne({ _id: user._id }, { $set: { email: user.email } }, { upsert: true });
      await Report.create({ owner, input: { url: 'https://example.com/jobs/1' }, status: 'completed', expiresAt: new Date(Date.now() + 86400000) });
      await removeUserAccount(user);
      assert.equal(await Report.countDocuments({ owner }), 0);
    });
    await t.test('admission cannot leave evidence after an account is deleted during submission', async t => {
      const { removeUserAccount } = await import('../src/services/userAccountDeletion.js');
      const { default: Queue } = await import('../src/models/JobVerificationQueue.js');
      await Report.deleteMany({});
      await Queue.deleteMany({});
      const user = { _id: new mongoose.Types.ObjectId(), email: 'verification-race@example.test' };
      await User.collection.insertOne(user);
      let entered, release;
      const started = new Promise(resolve => { entered = resolve; });
      const paused = new Promise(resolve => { release = resolve; });
      const create = Report.create.bind(Report);
      t.mock.method(Report, 'create', async (...args) => { entered(); await paused; return create(...args); });
      const admission = service.submit(user._id, { url: 'https://example.com/jobs/race' });
      await started;
      await removeUserAccount(user);
      release();
      await assert.rejects(admission, { status: 403 });
      assert.equal(await Report.countDocuments({ owner: user._id }), 0);
      assert.equal((await Queue.findById('pending').lean())?.reportIds.length || 0, 0);
      await assert.rejects(service.submit(user._id, { url: 'https://example.com/jobs/again' }), { status: 403 });
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
