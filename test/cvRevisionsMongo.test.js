import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Resume from '../src/models/Resume.js';
import ResumeArtifact from '../src/models/ResumeArtifact.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { inspectResume } from '../src/utils/resumeFile.js';
import { requestResumePreparation, drainResumePreparations } from '../src/services/resumePreparationService.js';
import { requestTailoredResume, drainTailoredResumes } from '../src/services/resumeTailoringService.js';
import { getCandidateEvidenceSnapshot, mutateCandidateEvidence } from '../src/services/candidateEvidenceService.js';
import { createResumeArtifact } from '../src/services/resumeArtifactService.js';
import { uploadResume } from '../src/controllers/resumeController.js';

const source = Buffer.from('\\documentclass{article}\n\\begin{document}Asha Rao, asha@example.test. Built React applications in 2025. BSc Computer Science 2026.\\end{document}');
const generated = label => ({ latex: `\\documentclass{article}\n\\begin{document}Asha Rao. ${label}.\\end{document}`, pdf: Buffer.from(`%PDF-1.7\n${label}\n%%EOF`), pageCount: 1, facts: { name: 'Asha Rao', sourceText: 'Asha Rao built React applications.' }, modelVersion: 'local-test', styleVersion: 'test' });
const dispatch = async () => {};

test('CV revisions retain immutable documents, scope history and restore atomically with conflict checks', { timeout: 120000 }, async t => {
  const history = await import('../src/services/cvRevisionService.js').catch(() => ({}));
  assert.equal(typeof history.listCvRevisions, 'function', 'durable CV history must be implemented');
  const { default: CVRevision } = await import('../src/models/CVRevision.js');
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'cv_revision_test' });
  await Promise.all([CVRevision.init(), Resume.init(), TailoredResume.init()]);
  const id = new mongoose.Types.ObjectId(); const other = new mongoose.Types.ObjectId(); const jobId = new mongoose.Types.ObjectId(); const otherJob = new mongoose.Types.ObjectId();
  const user = { _id: id }; const baseScope = { kind: 'base' }; const tailoredScope = { kind: 'tailored', jobId: String(jobId) };
  await User.collection.insertMany([{ _id: id, email: 'cv@example.test', savedJobs: [jobId] }, { _id: other, email: 'other-cv@example.test' }]);
  await Job.collection.insertOne({ _id: jobId, title: 'React Engineer', company: 'Example', location: 'Pune, India', isPublicIndia: true, jobType: 'Full-time Experienced', status: 'active', postedAt: new Date(), description: 'Build React applications.', fingerprint: 'cv-history-job' });
  await Resume.create({ _id: id, user: id, ...inspectResume('original.tex', source), data: source });
  async function prepare(label) {
    await requestResumePreparation(user, { regenerate: true, dispatch });
    assert.deepEqual(await drainResumePreparations({ generate: async () => generated(label) }), { attempted: 1, completed: 1, failed: 0 });
    return Resume.findById(id).lean();
  }
  const first = await prepare('First version');
  const second = await prepare('Second version');
  let base = await history.listCvRevisions(user, baseScope);
  assert.equal(base.items.length, 2);
  assert.equal(base.currentRevisionId, second.currentRevisionId);
  assert.equal(base.items[1].generationId, first.preparation.generationId);
  assert.equal(base.items[1].actor, String(id));
  assert.equal(base.items[1].reason, 'generated');
  await CVRevision.updateOne({ _id: base.items[1].id }, { $set: { reason: 'restored', sourceSnapshot: { filename: 'tampered' }, actor: other } });
  const immutable = await CVRevision.findById(base.items[1].id).lean();
  assert.equal(immutable.reason, 'generated'); assert.equal(immutable.sourceSnapshot.filename, 'original.tex'); assert.equal(String(immutable.actor), String(id));
  const retained = await history.getCvRevisionArtifact(user, baseScope, base.items[1].id);
  assert.match(retained.artifact.pdf.buffer.toString(), /First version/);
  assert.equal(await ResumeArtifact.countDocuments({ user: id }), 2);
  assert.deepEqual((await history.listCvRevisions({ _id: other }, baseScope)).items, []);
  await assert.rejects(history.getCvRevisionArtifact({ _id: other }, baseScope, base.items[1].id), { statusCode: 404 });
  const comparison = await history.compareCvRevisions(user, baseScope, { from: base.items[1].id, to: base.items[0].id });
  assert.match(comparison.from.latex, /First version/);
  assert.match(comparison.to.latex, /Second version/);
  assert.equal(comparison.from.sourceSnapshot.filename, 'original.tex');
  assert.equal(comparison.from.evidenceSnapshot.version, 0);
  assert.ok(comparison.changes.some(change => change.field === 'latex'));
  const beforeFailure = base.currentRevisionId;
  await requestResumePreparation(user, { regenerate: true, dispatch });
  await drainResumePreparations({ generate: async () => { throw Error('model offline'); } });
  assert.equal((await history.listCvRevisions(user, baseScope)).currentRevisionId, beforeFailure);
  assert.equal(await CVRevision.countDocuments({ user: id }), 2);
  const restored = await history.restoreCvRevision(user, baseScope, base.items[1].id, { expectedCurrentRevisionId: beforeFailure });
  assert.notEqual(restored.id, base.items[1].id);
  assert.equal(restored.restoredFrom, base.items[1].id);
  assert.equal(restored.generationId, first.preparation.generationId);
  assert.equal(await CVRevision.countDocuments({ user: id }), 3);
  await t.test('a failed generated publication rolls back artifact, revision and current pointer together', async () => {
    await requestResumePreparation(user, { regenerate: true, dispatch });
    const leaseOwner = 'rollback-worker';
    await Resume.updateOne({ _id: id }, { $set: { 'preparation.status': 'running', 'preparation.leaseOwner': leaseOwner, 'preparation.leaseUntil': new Date(Date.now() + 60000) } });
    const row = await Resume.findById(id).select('+preparation.leaseOwner').lean();
    const count = await ResumeArtifact.countDocuments({ user: id });
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await history.publishGeneratedCv({ kind: 'base', row, source: row, document: { text: 'The original extracted source.' }, evidence: await getCandidateEvidenceSnapshot(id), output: generated('must roll back'),
          lease: { _id: id, user: id, 'preparation.revision': row.preparation.revision, 'preparation.status': 'running', 'preparation.leaseOwner': leaseOwner } }, { session });
        throw Error('abort generated publication');
      }), /abort generated publication/);
    } finally { await session.endSession(); }
    assert.equal(await ResumeArtifact.countDocuments({ user: id }), count);
    assert.equal(await CVRevision.countDocuments({ user: id }), 3);
    assert.equal((await Resume.findById(id).lean()).currentRevisionId, restored.id);
    await Resume.updateOne({ _id: id }, { $set: { 'preparation.status': 'failed', 'preparation.ready': false } });
  });
  await assert.rejects(history.restoreCvRevision(user, baseScope, base.items[0].id, { expectedCurrentRevisionId: beforeFailure }), { statusCode: 409 });
  base = await history.listCvRevisions(user, baseScope);
  const session = await mongoose.startSession();
  try {
    await assert.rejects(session.withTransaction(async () => {
      await history.restoreCvRevision(user, baseScope, base.items[1].id, { expectedCurrentRevisionId: restored.id, session });
      throw Error('abort publication');
    }), /abort publication/);
  } finally { await session.endSession(); }
  assert.equal((await history.listCvRevisions(user, baseScope)).currentRevisionId, restored.id);
  assert.equal(await CVRevision.countDocuments({ user: id }), 3);
  await requestTailoredResume(user, String(jobId), { dispatch });
  await drainTailoredResumes({ generate: async () => generated('Tailored one') });
  await requestTailoredResume(user, String(jobId), { regenerate: true, dispatch });
  await drainTailoredResumes({ generate: async () => generated('Tailored two') });
  const tailored = await history.listCvRevisions(user, tailoredScope);
  assert.equal(tailored.items.length, 2);
  await assert.rejects(history.restoreCvRevision(user, { kind: 'tailored', jobId: String(otherJob) }, tailored.items[1].id, { expectedCurrentRevisionId: tailored.currentRevisionId }), { statusCode: 404 });
  const [left, right] = await Promise.allSettled([
    history.restoreCvRevision(user, tailoredScope, tailored.items[1].id, { expectedCurrentRevisionId: tailored.currentRevisionId }),
    history.restoreCvRevision(user, tailoredScope, tailored.items[1].id, { expectedCurrentRevisionId: tailored.currentRevisionId }),
  ]);
  assert.equal([left, right].filter(result => result.status === 'fulfilled').length, 1, 'only one concurrent restore publishes');
  assert.equal([left, right].find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal((await history.listCvRevisions(user, tailoredScope)).items.length, 3);
  await t.test('a job that ages out of public visibility cannot restore its old tailored revision', async st => {
    const current = await history.listCvRevisions(user, tailoredScope);
    st.mock.timers.enable({ apis: ['Date'], now: Date.now() + 40 * 86400000 });
    await assert.rejects(history.restoreCvRevision(user, tailoredScope, tailored.items[1].id, { expectedCurrentRevisionId: current.currentRevisionId }), { statusCode: 409 });
  });
  await Job.deleteOne({ _id: jobId });
  assert.equal((await history.listCvRevisions(user, tailoredScope)).items.length, 3, 'history survives job deletion');
  assert.match((await history.getCvRevisionArtifact(user, tailoredScope, tailored.items[1].id)).artifact.pdf.buffer.toString(), /Tailored one/);
  await assert.rejects(history.restoreCvRevision(user, tailoredScope, tailored.items[1].id, { expectedCurrentRevisionId: (await history.listCvRevisions(user, tailoredScope)).currentRevisionId }), { statusCode: 409 });
  await t.test('evidence edits invalidate in-flight output and old restores while preserving downloadable history', async () => {
    const previous = await history.listCvRevisions(user, baseScope);
    const artifactCount = await ResumeArtifact.countDocuments({ user: id });
    await requestResumePreparation(user, { regenerate: true, dispatch });
    const result = await drainResumePreparations({ generate: async input => {
      assert.equal(input.candidateEvidence.version, 0);
      await mutateCandidateEvidence(id, { collection: 'achievements', action: 'create', body: { version: 0, claim: 'Reduced latency by 25%', skills: ['Redis'] } });
      return generated('outdated evidence');
    } });
    assert.deepEqual(result, { attempted: 1, completed: 0, failed: 1 });
    assert.equal(await ResumeArtifact.countDocuments({ user: id }), artifactCount);
    assert.equal((await history.listCvRevisions(user, baseScope)).currentRevisionId, previous.currentRevisionId);
    await assert.rejects(history.restoreCvRevision(user, baseScope, previous.items[1].id, { expectedCurrentRevisionId: previous.currentRevisionId }), { statusCode: 409 });
    assert.ok((await history.getCvRevisionArtifact(user, baseScope, previous.items[1].id)).artifact);
    await requestResumePreparation(user, { regenerate: true, dispatch });
    await drainResumePreparations({ generate: async input => { assert.equal(input.candidateEvidence.version, 1); assert.equal(input.candidateEvidence.achievements[0].claim, 'Reduced latency by 25%'); return generated('current evidence'); } });
    const latest = await history.listCvRevisions(user, baseScope);
    const snapshot = await CVRevision.findById(latest.currentRevisionId).lean();
    assert.equal(snapshot.evidenceSnapshot.version, 1);
    assert.deepEqual(snapshot.evidenceSnapshot.skills, ['Redis']);
  });
  await t.test('legacy current artifacts are adopted once and cannot restore across unknown changed evidence', async () => {
    const legacyUser = { _id: other };
    const file = inspectResume('legacy.tex', source);
    const artifact = await createResumeArtifact({ user: other, kind: 'base', sourceResumeSha: file.sha256 }, generated('legacy base'));
    await Resume.create({ _id: other, user: other, ...file, data: source, preparation: { status: 'completed', generationId: artifact._id, outputResumeSha: file.sha256 } });
    const [left, right] = await Promise.all([history.listCvRevisions(legacyUser, baseScope), history.listCvRevisions(legacyUser, baseScope)]);
    assert.equal(left.items.length, 1); assert.equal(right.items.length, 1);
    assert.equal(left.items[0].reason, 'legacy_import');
    assert.equal(await CVRevision.countDocuments({ user: other }), 1);
    assert.ok((await history.getCvRevisionArtifact(legacyUser, baseScope, left.items[0].id)).artifact);
    const restoredLegacy = await history.restoreCvRevision(legacyUser, baseScope, left.items[0].id, { expectedCurrentRevisionId: left.currentRevisionId });
    const { getBaseResumeArtifact } = await import('../src/services/resumePreparationService.js');
    assert.ok((await getBaseResumeArtifact(legacyUser)).artifact, 'restored legacy with an unchanged empty bank stays usable');
    await mutateCandidateEvidence(other, { collection: 'achievements', action: 'create', body: { version: 0, claim: 'New confirmed evidence', skills: ['SQL'] } });
    await assert.rejects(history.restoreCvRevision(legacyUser, baseScope, left.items[0].id, { expectedCurrentRevisionId: restoredLegacy.id }), { statusCode: 409 });
  });
  await t.test('legacy tailoring archives the published artifact source rather than a newer queued request', async () => {
    const oldSha = 'a'.repeat(64); const oldJobHash = 'old-job-hash'; const oldBase = 'old-base-generation';
    const legacyArtifact = await createResumeArtifact({ user: other, job: otherJob, kind: 'tailored', sourceResumeSha: oldSha, sourceJobHash: oldJobHash, sourceBaseGenerationId: oldBase }, generated('older tailored source'));
    await TailoredResume.create({ _id: `${other}:${otherJob}`, user: other, job: otherJob, status: 'queued', sourceResumeSha: 'b'.repeat(64), sourceJobHash: 'new-job-hash', sourceBaseGenerationId: 'new-base',
      generationId: legacyArtifact._id, outputResumeSha: oldSha, outputJobHash: oldJobHash, outputBaseGenerationId: oldBase });
    const scope = { kind: 'tailored', jobId: String(otherJob) };
    const adopted = await history.listCvRevisions({ _id: other }, scope);
    const detail = (await history.getCvRevisionArtifact({ _id: other }, scope, adopted.items[0].id)).revision;
    assert.equal(detail.sourceSnapshot.sha256, oldSha);
    assert.equal(detail.sourceSnapshot.jobHash, oldJobHash);
    assert.equal(detail.sourceSnapshot.baseGenerationId, oldBase);
    assert.equal(detail.sourceSnapshot.filename, 'Earlier uploaded resume');
  });
  await t.test('CV removal rolls back as one operation and a concurrent new upload retains its new publication', async () => {
    assert.equal(typeof history.removeCvDocuments, 'function', 'removal must participate in the same publication transaction fence');
    const current = await history.listCvRevisions(user, baseScope);
    const count = await ResumeArtifact.countDocuments({ user: id });
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await history.removeCvDocuments(user, { session });
        assert.equal(await CVRevision.countDocuments({ user: id }).session(session), 0);
        assert.equal(await ResumeArtifact.countDocuments({ user: id }).session(session), 0);
        throw Error('abort CV removal');
      }), /abort CV removal/);
      assert.equal((await history.listCvRevisions(user, baseScope)).currentRevisionId, current.currentRevisionId);
      assert.equal(await ResumeArtifact.countDocuments({ user: id }), count);
      session.startTransaction();
      await history.removeCvDocuments(user, { session });
      const uploaded = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      process.env.TAILORED_RESUME_ACTIONS_ENABLED = 'false';
      const uploading = uploadResume({ user, headers: { 'x-resume-filename': 'new-upload.tex' }, body: Buffer.from(source.toString().replace('React applications', 'React and Redis applications')) }, uploaded);
      await session.commitTransaction();
      await uploading;
      assert.equal(uploaded.statusCode, 200);
      await prepare('new upload after removal');
      const fresh = await history.listCvRevisions(user, baseScope);
      assert.equal(fresh.items.length, 1);
      assert.equal(fresh.items[0].filename, 'new-upload.tex');
      assert.ok((await history.getCvRevisionArtifact(user, baseScope, fresh.currentRevisionId)).artifact);
      assert.equal(await ResumeArtifact.countDocuments({ user: id }), 1);
    } finally { await session.endSession(); }
  });
});
