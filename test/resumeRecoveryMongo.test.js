import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { recoverTailoredResumes } from '../src/services/resumeTailoringService.js';
import { dispatchTailoredResumes } from '../src/services/resumeTailoringWorkflow.js';
import { preparationMetadata, recoverResumePreparations } from '../src/services/resumePreparationService.js';

test('a workflow that fails before claiming work stops recovery and exposes retry without losing artifacts', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'resume_recovery_test' });
  for (const [key, value] of Object.entries({ GITHUB_PAT: 'test-only', GITHUB_REPO: 'example/backend', TAILORED_RESUME_ACTIONS_ENABLED: 'true' })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const now = new Date();
  const user = new mongoose.Types.ObjectId();
  const requestedAt = new Date(now.getTime() - 547 * 60000);
  const dispatchAt = new Date(now.getTime() - 6 * 60000);
  await Resume.collection.insertOne({ _id: user, user, sha256: 'a'.repeat(64), preparation: {
    status: 'queued', phase: 'queued', ready: true, attempts: 0, revision: 3, requestedAt, dispatchAt,
    generationId: 'previous-base', outputResumeSha: 'a'.repeat(64),
  } });
  await TailoredResume.collection.insertOne({ _id: 'queued-tailored', user, status: 'queued', phase: 'queued', ready: true,
    attempts: 0, revision: 2, requestedAt, dispatchAt, generationId: 'previous-tailored' });
  let posts = 0;
  const request = async (_repo, endpoint, options) => {
    if (endpoint.includes('/runs?')) return { workflow_runs: [{ status: 'completed', conclusion: 'failure' }] };
    if (!endpoint) return { default_branch: 'main' };
    if (options?.method === 'POST') posts++;
  };
  const dispatch = options => dispatchTailoredResumes({ ...options, request });
  await recoverTailoredResumes({ now, dispatch });
  await recoverTailoredResumes({ now: new Date(now.getTime() + 6 * 60000), dispatch });
  assert.equal(posts, 0, 'periodic recovery must not create another run for the same failed request');
  const base = await Resume.findById(user).lean();
  const tailored = await TailoredResume.findById('queued-tailored').lean();
  assert.equal(base.preparation.status, 'failed');
  assert.equal(base.preparation.ready, false);
  assert.equal(base.preparation.attempts, 0);
  assert.equal(base.preparation.generationId, 'previous-base');
  assert.equal(preparationMetadata(base).retryable, true);
  assert.equal(preparationMetadata(base).hasPdf, true);
  assert.match(base.preparation.error, /retry/i);
  assert.equal(tailored.status, 'failed');
  assert.equal(tailored.ready, false);
  assert.equal(tailored.generationId, 'previous-tailored');

  const reset = async () => {
    await Resume.updateOne({ _id: user }, { $set: { 'preparation.status': 'queued', 'preparation.phase': 'queued',
      'preparation.ready': true, 'preparation.dispatchAt': dispatchAt } });
    await TailoredResume.updateOne({ _id: 'queued-tailored' }, { $set: { status: 'queued', phase: 'queued', ready: true, dispatchAt } });
  };
  await t.test('standalone base recovery also exposes a failed request for explicit retry', async () => {
    await reset();
    await recoverResumePreparations({ now, dispatch });
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'failed');
  });
  await t.test('a worker claim or new retry while status is checked cannot be failed by stale recovery', async () => {
    await reset();
    const changed = async () => {
      await Resume.updateOne({ _id: user }, { $set: { 'preparation.status': 'running', 'preparation.leaseUntil': new Date(now.getTime() + 60000) } });
      await TailoredResume.updateOne({ _id: 'queued-tailored' }, { $set: { revision: 3, dispatchAt: now } });
      return { workflow_runs: [{ status: 'completed', conclusion: 'failure' }] };
    };
    await recoverTailoredResumes({ now, dispatch: options => dispatchTailoredResumes({ ...options, request: changed }) });
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'running');
    const fresh = await TailoredResume.findById('queued-tailored').lean();
    assert.equal(fresh.status, 'queued');
    assert.equal(fresh.revision, 3);
  });
  await t.test('an active worker keeps waiting requests queued despite an earlier failed run', async () => {
    await reset();
    await recoverTailoredResumes({ now, dispatch: options => dispatchTailoredResumes({ ...options,
      request: async () => ({ workflow_runs: [{ status: 'in_progress' }, { status: 'completed', conclusion: 'failure' }] }),
    }) });
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'queued');
    assert.equal((await TailoredResume.findById('queued-tailored').lean()).status, 'queued');
  });
  await t.test('temporary GitHub outages retain queued work', async () => {
    await reset();
    await recoverTailoredResumes({ now, dispatch: options => dispatchTailoredResumes({ ...options,
      request: async () => { throw Error('private upstream response'); },
    }) });
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'queued');
    assert.equal((await TailoredResume.findById('queued-tailored').lean()).status, 'queued');
  });
  await t.test('successful workflow completion can hand off remaining queued work', async () => {
    await reset();
    let handoffs = 0;
    const success = async (_repo, endpoint, options) => {
      if (endpoint.includes('/runs?')) return { workflow_runs: [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'failure' }] };
      if (!endpoint) return { default_branch: 'main' };
      if (options?.method === 'POST') handoffs++;
    };
    await recoverTailoredResumes({ now, dispatch: options => dispatchTailoredResumes({ ...options, request: success }) });
    assert.equal(handoffs, 1);
    assert.equal((await Resume.findById(user).lean()).preparation.status, 'queued');
  });
});
