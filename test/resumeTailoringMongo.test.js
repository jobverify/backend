import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import ResumeArtifact from '../src/models/ResumeArtifact.js';
import { requestResumePreparation, drainResumePreparations } from '../src/services/resumePreparationService.js';
import { removeUserAccount } from '../src/services/userAccountDeletion.js';
import { removeSavedJob } from '../src/controllers/userController.js';
import { getTailoredResume, requestTailoredResume, drainTailoredResumes, recoverTailoredResumes } from '../src/services/resumeTailoringService.js';

const latex = Buffer.from('\\documentclass{article}\n\\begin{document}Asha Rao. Built a React task manager in 2025. BSc Computer Science, 2026.\\end{document}');
const output = { latex: latex.toString(), pdf: Buffer.from('%PDF-1.7\nAsha Rao\n%%EOF'), pageCount: 1, facts: { name: 'Asha Rao' }, modelVersion: 'test', styleVersion: 'test' };
const hash = data => createHash('sha256').update(data).digest('hex');

test('saved-job tailoring persists, isolates owners, retries and rejects stale generations', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'tailoring-integration-test-secret-only';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'resume_tailoring_test' });
  const user = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  const owner = { _id: user };
  const job = String(jobId);
  await User.collection.insertMany([{ _id: user, email: 'asha@example.test', role: 'user', sessionVersion: 0, savedJobs: [jobId] }, { _id: other, email: 'other@example.test', role: 'user', sessionVersion: 0, savedJobs: [] }]);
  await Job.collection.insertOne({ _id: jobId, title: 'React Engineer', company: 'Example', location: 'Pune, India', isPublicIndia: true, jobType: 'Full-time Experienced', status: 'active', description: 'Build React applications.', fingerprint: 'tailoring-job' });
  let dispatched = 0;
  const options = { dispatch: async () => { dispatched++; } };
  await assert.rejects(requestTailoredResume({ _id: other }, job, options), /saved job/i);
  await assert.rejects(requestTailoredResume(owner, job, options), /upload.*resume/i);
  await assert.rejects(getTailoredResume(owner, 'invalid'), /job ID/i);
  await Resume.collection.insertOne({ _id: user, user, filename: 'resume.tex', extension: 'tex', mimeType: 'application/x-tex', sha256: hash(latex), size: latex.length, data: latex, uploadedAt: new Date() });
  await assert.rejects(requestTailoredResume(owner, job, options), /prepare/i);
  await requestResumePreparation(owner, options);
  await drainResumePreparations({ generate: async () => output });
  const rows = await Promise.all(Array.from({ length: 6 }, () => requestTailoredResume(owner, job, options)));
  assert.equal(new Set(rows.map(row => row.id)).size, 1);
  assert.equal(dispatched, 2);
  assert.equal(await TailoredResume.countDocuments(), 1);
  let generated = 0;
  const generate = async input => { generated++; assert.match(input.source.text, /Asha Rao/); assert.equal(input.jobSnapshot.title, 'React Engineer'); return output; };
  await Promise.all([drainTailoredResumes({ generate, maxTasks: 1 }), drainTailoredResumes({ generate, maxTasks: 1 })]);
  assert.equal(generated, 1);
  assert.equal((await getTailoredResume(owner, job)).status, 'completed');
  assert.equal((await getTailoredResume(owner, job)).output, undefined);
  assert.equal((await getTailoredResume(owner, job)).hasPdf, true);
  const completedGeneration = (await TailoredResume.findOne({ user }).lean()).generationId;
  assert.equal((await getTailoredResume(owner, job)).stale, false);
  await requestTailoredResume(owner, job, options);
  assert.equal(dispatched, 2, 'an identical completed request uses the saved output');

  await requestTailoredResume(owner, job, { ...options, regenerate: true });
  await drainTailoredResumes({ generate: async () => { throw Error('private provider payload'); }, maxTasks: 1 });
  const failed = await getTailoredResume(owner, job);
  assert.equal(failed.status, 'failed'); assert.equal(failed.hasPdf, true);
  assert.equal((await TailoredResume.findOne({ user }).lean()).generationId, completedGeneration);
  assert.doesNotMatch(failed.error, /private provider/);

  await requestTailoredResume(owner, job, { ...options, regenerate: true });
  await drainTailoredResumes({ generate: async () => {
    await Resume.updateOne({ _id: user }, { $set: { sha256: 'a'.repeat(64) } });
    return { ...output, summary: 'This result must not be published.' };
  }, maxTasks: 1 });
  const stale = await getTailoredResume(owner, job);
  assert.equal(stale.stale, true); assert.equal(stale.hasPdf, true);
  assert.equal((await TailoredResume.findOne({ user }).lean()).generationId, completedGeneration);
  assert.equal(stale.status, 'failed');
  await Resume.updateOne({ _id: user }, { $set: { sha256: hash(latex) } });
  await requestTailoredResume(owner, job, { ...options, regenerate: true });
  await TailoredResume.updateMany({}, { $set: { status: 'running', leaseUntil: new Date(0), attempts: 3 } });
  await recoverTailoredResumes({ dispatch: options.dispatch });
  assert.equal((await getTailoredResume(owner, job)).status, 'failed');

  const unbookmark = async () => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await removeSavedJob({ user: owner, params: { jobId: job }, siteSettings: {} }, res);
    assert.equal(res.body.saved, false);
    await User.updateOne({ _id: user }, { $addToSet: { savedJobs: jobId } });
  };
  await t.test('unbookmarking cancels queued generation even if the job is saved again', async () => {
    await requestTailoredResume(owner, job, { ...options, regenerate: true });
    await unbookmark();
    const result = await drainTailoredResumes({ generate: async () => assert.fail('cancelled work must not execute'), maxTasks: 1 });
    assert.equal(result.attempted, 0);
    assert.equal((await getTailoredResume(owner, job)).status, 'failed');
  });
  await t.test('unbookmarking during generation invalidates the in-flight revision', async () => {
    await requestTailoredResume(owner, job, { ...options, regenerate: true });
    await drainTailoredResumes({ generate: async () => { await unbookmark(); return { ...output, summary: 'Cancelled result must never publish.' }; }, maxTasks: 1 });
    const result = await getTailoredResume(owner, job);
    assert.equal(result.status, 'failed'); assert.equal(result.hasPdf, true);
    assert.equal((await TailoredResume.findOne({ user }).lean()).generationId, completedGeneration);
  });
  await t.test('dispatch bookkeeping cannot extend the per-generation expiry', async () => {
    await requestTailoredResume(owner, job, { ...options, regenerate: true });
    await TailoredResume.collection.updateOne({ user }, { $set: { requestedAt: new Date(Date.now() - 3 * 86400000), updatedAt: new Date(), dispatchAt: new Date(Date.now() - 360000) } });
    await recoverTailoredResumes({ dispatch: options.dispatch });
    assert.equal((await getTailoredResume(owner, job)).status, 'failed');
  });

  await t.test('the real request path dispatches the dedicated GitHub workflow independently', async t => {
    const config = { GITHUB_PAT: 'tailoring-test-token', GITHUB_REPO: 'example/backend', TAILORED_RESUME_ACTIONS_ENABLED: 'true' };
    for (const [key, value] of Object.entries(config)) {
      const old = process.env[key]; process.env[key] = value;
      t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
    }
    let dispatches = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.match(url, /^https:\/\/api\.github\.com\/repos\/example\/backend/);
      if (url.includes('/runs?')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
      if (url.endsWith('/example/backend')) return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
      assert.match(url, /\/tailored-resumes\.yml\/dispatches$/);
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { ref: 'main' });
      dispatches++;
      return { ok: true, status: 204 };
    });
    const queued = await requestTailoredResume(owner, job, { regenerate: true });
    assert.equal(queued.status, 'queued');
    assert.equal(dispatches, 1);
    await drainTailoredResumes({ generate: async () => output });
    assert.equal((await getTailoredResume(owner, job)).status, 'completed');
  });

  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const csrfResponse = await fetch(`${base}/api/auth/csrf-token`, { headers: { Origin: process.env.CORS_ORIGIN } });
  const { token: csrf } = await csrfResponse.json();
  const cookie = csrfResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const request = (suffix = '', { method = 'GET', identity = user, withCsrf = true } = {}) => fetch(`${base}/api/user/tailored-resumes/${job}${suffix}`, { method,
    headers: { Origin: process.env.CORS_ORIGIN, Cookie: cookie, 'Content-Type': 'application/json', ...(identity ? { Authorization: `Bearer ${jwt.sign({ id: String(identity), sessionVersion: 0 }, process.env.JWT_SECRET)}` } : {}), ...(withCsrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(method === 'POST' ? { body: '{}' } : {}) });
  assert.equal((await request('', { identity: null })).status, 401);
  assert.equal((await request('', { identity: other })).status, 404);
  assert.equal((await request('', { method: 'POST', withCsrf: false })).status, 403);
  const download = await request('/download');
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), output.pdf);
  const tex = await request('/download?format=tex');
  assert.equal(tex.status, 200); assert.match(await tex.text(), /Asha Rao/);
  assert.equal((await request('/download?format=txt')).status, 400);
  const preview = await request('/pdf');
  assert.equal(preview.status, 200); assert.match(preview.headers.get('content-disposition'), /inline/);
  assert.equal(preview.headers.get('cache-control'), 'no-store');
  await Resume.updateOne({ _id: user }, { $set: { sha256: 'b'.repeat(64) } });
  assert.equal((await request('/download')).status, 409);
  const originalDelete = await fetch(`${base}/api/user/resume`, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt.sign({ id: String(user), sessionVersion: 0 }, process.env.JWT_SECRET)}`, Origin: process.env.CORS_ORIGIN, Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' } });
  assert.equal(originalDelete.status, 200);
  assert.equal(await TailoredResume.countDocuments({ user }), 0, 'removing an original removes all derived resumes');
  assert.equal(await ResumeArtifact.countDocuments({ user }), 0, 'removing an original removes generated binaries');
  await TailoredResume.collection.insertOne({ _id: `${user}:${jobId}`, user, job: jobId });
  await removeUserAccount({ _id: user, email: 'asha@example.test' });
  assert.equal(await TailoredResume.countDocuments({ user }), 0, 'account deletion removes derived resumes');
});
