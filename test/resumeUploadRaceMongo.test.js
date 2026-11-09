import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Resume from '../src/models/Resume.js';
import ResumeArtifact from '../src/models/ResumeArtifact.js';
import TailoredResume from '../src/models/TailoredResume.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import { uploadResume } from '../src/controllers/resumeController.js';
import { inspectResume } from '../src/utils/resumeFile.js';
import { createResumeArtifact } from '../src/services/resumeArtifactService.js';
import { requestResumePreparation, drainResumePreparations } from '../src/services/resumePreparationService.js';
import { requestTailoredResume } from '../src/services/resumeTailoringService.js';

const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const source = label => Buffer.from(`\\documentclass{article}\n\\begin{document}Asha Rao. ${label} React project in 2025. BSc Computer Science, 2026.\\end{document}`);
const output = bytes => ({ latex: bytes.toString(), pdf: Buffer.from('%PDF-1.7\nvalidated resume\n%%EOF'), pageCount: 1 });

test('a delayed upload cleans up only the source it replaced and preserves a newer upload artifact and queued tailoring', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.TAILORED_RESUME_ACTIONS_ENABLED = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'resume_upload_race' });
  const id = new mongoose.Types.ObjectId();
  const oldJob = new mongoose.Types.ObjectId();
  const newJob = new mongoose.Types.ObjectId();
  const owner = { _id: id };
  await User.collection.insertOne({ _id: id, email: 'race@example.test', savedJobs: [oldJob, newJob] });
  await Job.collection.insertOne({ _id: newJob, title: 'React Engineer', company: 'Example', location: 'Pune, India', isPublicIndia: true, jobType: 'Full-time Experienced', status: 'active', description: 'Build React applications.', fingerprint: 'upload-race-job' });
  const original = source('Original');
  const initialFile = inspectResume('original.tex', original);
  const priorBase = await createResumeArtifact({ user: id, kind: 'base', sourceResumeSha: initialFile.sha256 }, output(original));
  await Resume.create({ _id: id, user: id, ...initialFile, data: original, preparation: { status: 'completed', revision: 1,
    generationId: priorBase._id, sourceSha: initialFile.sha256, outputResumeSha: initialFile.sha256, pageCount: 1 } });
  await TailoredResume.collection.insertOne({ _id: `${id}:${oldJob}`, user: id, job: oldJob, status: 'queued', ready: true,
    revision: 1, sourceResumeSha: initialFile.sha256, sourceBaseGenerationId: priorBase._id, sourceJobHash: 'old-job-hash' });
  const savedA = Promise.withResolvers();
  const releaseA = Promise.withResolvers();
  const exists = User.exists.bind(User);
  let checks = 0;
  t.mock.method(User, 'exists', async filter => {
    if (++checks === 2) { savedA.resolve(); await releaseA.promise; }
    return exists(filter);
  });
  const firstResponse = response();
  const uploadA = uploadResume({ user: owner, headers: { 'x-resume-filename': 'a.tex' }, body: source('Upload A') }, firstResponse);
  await savedA.promise;
  const secondResponse = response();
  const newest = source('Upload B');
  await uploadResume({ user: owner, headers: { 'x-resume-filename': 'b.tex' }, body: newest }, secondResponse);
  assert.equal(secondResponse.statusCode, 200);
  await requestResumePreparation(owner, { dispatch: async () => {} });
  assert.deepEqual(await drainResumePreparations({ generate: async () => output(newest) }), { attempted: 1, completed: 1, failed: 0 });
  const currentBeforeA = await Resume.findById(id).lean();
  await requestTailoredResume(owner, String(newJob), { dispatch: async () => {} });
  const queuedBeforeA = await TailoredResume.findById(`${id}:${newJob}`).lean();
  // A failed later preparation may retain B's successful PDF. The delayed A
  // request must not interpret B's failure as permission to prepare B again.
  await Resume.updateOne({ _id: id }, { $set: { 'preparation.status': 'failed', 'preparation.ready': false } });
  releaseA.resolve();
  await uploadA;
  assert.equal(firstResponse.statusCode, 200);
  assert.equal((await Resume.findById(id).lean()).sha256, inspectResume('b.tex', newest).sha256);
  assert.equal((await Resume.findById(id).lean()).preparation.status, 'failed', 'A must not queue preparation of B');
  assert.equal((await Resume.findById(id).lean()).preparation.revision, currentBeforeA.preparation.revision);
  assert.ok(await ResumeArtifact.exists({ _id: currentBeforeA.preparation.generationId, user: id }), 'delayed cleanup must preserve the newest base PDF');
  const queuedAfterA = await TailoredResume.findById(`${id}:${newJob}`).lean();
  assert.equal(queuedAfterA.status, 'queued', 'delayed invalidation must preserve work queued for the newest source');
  assert.equal(queuedAfterA.revision, queuedBeforeA.revision);
  assert.equal(queuedAfterA.ready, true);
  assert.ok(await ResumeArtifact.exists({ _id: priorBase._id, user: id }), 'the replaced base is retained for history');
  assert.equal((await TailoredResume.findById(`${id}:${oldJob}`).lean()).status, 'failed');
});
