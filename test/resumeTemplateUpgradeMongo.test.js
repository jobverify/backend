import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { getCandidateEvidenceSnapshot } from '../src/services/candidateEvidenceService.js';
import { resumeJobHash } from '../src/services/resumeLatexContent.js';
import { requestResumePreparation } from '../src/services/resumePreparationService.js';
import { getTailoredResume, requestTailoredResume } from '../src/services/resumeTailoringService.js';

test('existing template generations queue AI preparation and cannot be reused as current tailored output', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'resume_ai_upgrade_test' });
  const user = new mongoose.Types.ObjectId(), jobId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: user, email: 'upgrade@example.test', savedJobs: [jobId] });
  const job = { _id: jobId, title: 'Python Engineer', company: 'Example Systems', location: 'Pune, India',
    isPublicIndia: true, jobType: 'Full-time Experienced', status: 'active', description: 'Build Python services.', fingerprint: 'upgrade-job' };
  await Job.collection.insertOne(job);
  const evidence = await getCandidateEvidenceSnapshot(user);
  const sha = 'a'.repeat(64);
  await Resume.collection.insertOne({ _id: user, user, filename: 'resume.tex', extension: 'tex', sha256: sha,
    preparation: { status: 'completed', revision: 1, generationId: 'old-base', outputResumeSha: sha,
      modelVersion: 'source-template:v1', outputEvidenceVersion: evidence.version, outputEvidenceHash: evidence.hash } });
  await TailoredResume.collection.insertOne({ _id: `${user}:${jobId}`, user, job: jobId, status: 'completed',
    generationId: 'old-tailored', outputResumeSha: sha, outputJobHash: resumeJobHash(job), outputBaseGenerationId: 'old-base',
    modelVersion: 'source-template:v1', outputEvidenceVersion: evidence.version, outputEvidenceHash: evidence.hash });
  const owner = { _id: user };
  const oldTailored = await getTailoredResume(owner, String(jobId));
  assert.equal(oldTailored.stale, true);
  assert.equal(oldTailored.hasPdf, true);
  await assert.rejects(requestTailoredResume(owner, String(jobId), { dispatch: async () => {} }), { statusCode: 409 });
  let dispatches = 0;
  const dispatch = async () => { dispatches++; };
  const preparation = await requestResumePreparation(owner, { dispatch });
  assert.equal(preparation.preparation.status, 'queued');
  assert.equal(preparation.preparation.stale, true);
  assert.equal((await Resume.findById(user).lean()).preparation.generationId, 'old-base');
  await requestResumePreparation(owner, { dispatch });
  assert.equal(dispatches, 1, 'repeated clicks reuse the queued upgrade');
});
