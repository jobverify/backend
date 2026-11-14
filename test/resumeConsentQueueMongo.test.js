import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { uploadResume } from '../src/controllers/resumeController.js';
import { requestResumePreparation, drainResumePreparations, getBaseResumeArtifact } from '../src/services/resumePreparationService.js';
import { requestTailoredResume, drainTailoredResumes, nextResumeDocumentTask, recoverTailoredResumes, getTailoredResumeArtifact } from '../src/services/resumeTailoringService.js';

const processingConsent = { version: '2026-11-14', accepted: true };
const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const latex = '\\documentclass{article}\n\\begin{document}Asha Rao, asha@example.test. React project, 2025. BSc 2026.\\end{document}';
const generated = { latex, pdf: Buffer.from('%PDF-1.7\ncompiled-test-document\n%%EOF'), pageCount: 1, facts: { name: 'Asha Rao' }, modelVersion: 'local-test', styleVersion: 'test' };
const idle = { attempted: 0, completed: 0, failed: 0 };

test('resume queues require consent before any new worker processing or recovery', { timeout: 120000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ instanceOpts: [{ launchTimeout: 30000 }], replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'resume_consent_queue_test' });
  const user = new mongoose.Types.ObjectId();
  const job = new mongoose.Types.ObjectId();
  const owner = { _id: user };
  const tailoredId = `${user}:${job}`;
  await User.collection.insertOne({ _id: user, email: 'asha@example.test', savedJobs: [job] });
  await Job.collection.insertOne({ _id: job, title: 'React Engineer', company: 'Example', location: 'Pune, India', isPublicIndia: true, jobType: 'Full-time Experienced', status: 'active', description: 'Build React applications.', fingerprint: 'consent-job' });
  const uploaded = response();
  await uploadResume({ user: owner, headers: { 'x-resume-filename': 'resume.tex' }, body: Buffer.from(latex) }, uploaded);
  assert.equal(uploaded.statusCode, 200);
  let dispatched = 0;
  const dispatch = async () => { dispatched++; };

  await t.test('services reject omitted, malformed and obsolete consent before queueing', async () => {
    for (const invalid of [undefined, {}, true, { accepted: false, version: '2026-11-14' }, { accepted: true, version: '2025-01-01' }]) {
      await assert.rejects(requestResumePreparation(owner, { processingConsent: invalid, dispatch }), { statusCode: 428 });
      await assert.rejects(requestTailoredResume(owner, String(job), { processingConsent: invalid, dispatch }), { statusCode: 428 });
    }
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'unprepared');
    assert.equal(await TailoredResume.countDocuments(), 0);
    assert.equal(dispatched, 0);
  });

  await t.test('legacy queued and expired work is never selected, claimed or redispatched', async () => {
    for (const status of ['queued', 'running']) {
      await Resume.collection.updateOne({ _id: user }, { $set: { 'preparation.status': status, 'preparation.ready': true,
        'preparation.attempts': 0, 'preparation.requestedAt': new Date(), 'preparation.leaseUntil': new Date(0) } });
      await TailoredResume.collection.replaceOne({ _id: tailoredId }, { _id: tailoredId, user, job, status, ready: true, attempts: 0,
        revision: 1, sourceResumeSha: uploaded.body.data.sha256, sourceJobHash: 'legacy', requestedAt: new Date(), leaseUntil: new Date(0) }, { upsert: true });
      assert.equal(await nextResumeDocumentTask(), null);
      assert.deepEqual(await drainResumePreparations({ generate: async () => assert.fail('unconsented base work must not run') }), idle);
      assert.deepEqual(await drainTailoredResumes({ generate: async () => assert.fail('unconsented tailored work must not run') }), idle);
      await recoverTailoredResumes({ dispatch });
      assert.equal(dispatched, 0);
      assert.equal((await Resume.findById(user).lean()).preparation.status, 'failed');
      assert.equal((await TailoredResume.findById(tailoredId).lean()).status, 'failed');
    }
  });

  await t.test('new requests persist a current server timestamp with their pinned source revision', async () => {
    const before = Date.now();
    await requestResumePreparation(owner, { processingConsent, dispatch });
    const queued = await Resume.findById(user).lean();
    assert.equal(queued.preparation.processingConsentVersion, '2026-11-14');
    assert.ok(queued.preparation.processingConsentAcceptedAt instanceof Date);
    assert.ok(queued.preparation.processingConsentAcceptedAt.getTime() >= before);
    assert.equal(queued.preparation.sourceSha, uploaded.body.data.sha256);
    const task = await nextResumeDocumentTask();
    assert.equal(task.kind, 'base');
    assert.equal(task.row.preparation.revision, queued.preparation.revision);
    assert.deepEqual(await drainResumePreparations({ generate: async () => generated }), { attempted: 1, completed: 1, failed: 0 });
    await requestTailoredResume(owner, String(job), { processingConsent, dispatch });
    const tailored = await TailoredResume.findById(tailoredId).lean();
    assert.equal(tailored.processingConsentVersion, '2026-11-14');
    assert.ok(tailored.processingConsentAcceptedAt instanceof Date);
    assert.ok(tailored.processingConsentAcceptedAt.getTime() >= before);
    assert.equal(tailored.sourceResumeSha, uploaded.body.data.sha256);
    assert.equal(tailored.sourceBaseGenerationId, (await Resume.findById(user).lean()).preparation.generationId);
    assert.deepEqual(await drainTailoredResumes({ generate: async () => generated }), { attempted: 1, completed: 1, failed: 0 });
  });

  await t.test('obsolete and undated queue markers cannot resume processing', async () => {
    for (const marker of [{ processingConsentVersion: '2025-01-01', processingConsentAcceptedAt: new Date() },
      { processingConsentVersion: '2026-11-14', processingConsentAcceptedAt: null },
      { processingConsentVersion: '2026-11-14', processingConsentAcceptedAt: 'not-a-date' }]) {
      await Resume.collection.updateOne({ _id: user }, { $set: { 'preparation.status': 'queued', 'preparation.ready': true,
        'preparation.processingConsentVersion': marker.processingConsentVersion, 'preparation.processingConsentAcceptedAt': marker.processingConsentAcceptedAt } });
      await TailoredResume.collection.updateOne({ _id: tailoredId }, { $set: { status: 'queued', ready: true, ...marker } });
      assert.equal(await nextResumeDocumentTask(), null);
      assert.deepEqual(await drainResumePreparations({ generate: async () => assert.fail('invalid consent must not run') }), idle);
      assert.deepEqual(await drainTailoredResumes({ generate: async () => assert.fail('invalid consent must not run') }), idle);
      const count = dispatched;
      await recoverTailoredResumes({ dispatch });
      assert.equal(dispatched, count);
    }
  });

  await t.test('completed documents without the new marker remain readable and downloadable', async () => {
    await Resume.collection.updateOne({ _id: user }, { $set: { 'preparation.status': 'completed' },
      $unset: { 'preparation.processingConsentVersion': '', 'preparation.processingConsentAcceptedAt': '' } });
    await TailoredResume.collection.updateOne({ _id: tailoredId }, { $set: { status: 'completed' },
      $unset: { processingConsentVersion: '', processingConsentAcceptedAt: '' } });
    await recoverTailoredResumes({ dispatch });
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'completed');
    assert.equal((await TailoredResume.findById(tailoredId).lean()).status, 'completed');
    assert.ok((await getBaseResumeArtifact(owner)).artifact);
    assert.ok((await getTailoredResumeArtifact(owner, String(job))).artifact);
  });
});
