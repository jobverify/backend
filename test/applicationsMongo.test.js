import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { recordApplicationOpen } from '../src/services/applicationService.js';

test('MongoDB and HTTP application lifecycle preserves manual status, privacy and history', { timeout: 90000 }, async t => {
  const mongo = new MongoMemoryReplSet({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  });
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'application-lifecycle-test-secret-only-12345';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  await mongo.start();
  await mongoose.connect(mongo.getUri(), { dbName: 'application_lifecycle_test' });
  await Promise.all([Application.init(), ApplicationEvent.init()]);
  const user = new mongoose.Types.ObjectId();
  const otherUser = new mongoose.Types.ObjectId();
  await User.collection.insertMany([
    { _id: user, email: 'application@example.test', role: 'user', sessionVersion: 0 },
    { _id: otherUser, email: 'other@example.test', role: 'user', sessionVersion: 0 },
  ]);
  const jobId = new mongoose.Types.ObjectId();
  const job = { _id: jobId, title: 'Software Engineer', company: 'Example Corp', location: 'Pune', jobType: 'Full-time Fresher',
    sourceUrl: 'https://example.test/jobs/123', sourceDescription: 'Build applications and collaborate with engineers.', description: 'Build applications and collaborate with engineers.',
    status: 'active', isPublicIndia: true, clickCount: 0, fingerprint: 'application-test-job' };
  await Job.collection.insertOne(job);
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const csrfResponse = await fetch(`${base}/api/auth/csrf-token`, { headers: { Origin: process.env.CORS_ORIGIN } });
  const { token: csrf } = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
  async function request(path, { method = 'GET', owner = user, includeCsrf = true, body } = {}) {
    const auth = owner ? `jobverify_token=${jwt.sign({ id: owner.toString(), sessionVersion: 0 }, process.env.JWT_SECRET)}` : '';
    const response = await fetch(`${base}${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}), headers: {
      Origin: process.env.CORS_ORIGIN, 'Content-Type': 'application/json',
      Cookie: `${auth}; ${csrfCookie}`, ...(includeCsrf ? { 'X-CSRF-Token': csrf } : {}),
    } });
    return { status: response.status, body: await response.json() };
  }

  assert.equal((await request('/api/user/applications', { owner: null })).status, 401);
  const untracked = await request(`/api/jobs/${jobId}/click`, { method: 'POST' });
  assert.equal(untracked.status, 200);
  assert.equal(untracked.body.data.application.status, 'opened', 'Apply tracks intent even with a personal CV');
  assert.equal(untracked.body.data.application.appliedAt, null);
  assert.equal(await Application.countDocuments({ user }), 1);
  assert.equal((await request('/api/user/applications')).body.data.length, 0, 'An Apply click alone does not add a tracked job');
  await Application.deleteMany({ user }); // Exercise resume-only history separately below.
  await TailoredResume.collection.insertOne({ _id: `${otherUser}:${jobId}`, user: otherUser, job: jobId, status: 'completed', outputFormat: 'latex-pdf', generationId: 'other-user-generation' });
  await TailoredResume.collection.insertOne({ _id: `${user}:${jobId}`, user, job: jobId, status: 'queued', output: null });
  for (const resumeStatus of ['queued', 'running', 'failed', 'completed']) {
    await TailoredResume.updateOne({ user, job: jobId }, { $set: { status: resumeStatus } });
    const pending = await request('/api/user/applications');
    assert.equal(pending.status, 200);
    assert.equal(pending.body.data.length, 1, `${resumeStatus} resumes appear without an employer click`);
    assert.equal(pending.body.data[0].resumeStatus, resumeStatus);
    assert.equal(pending.body.data[0].jobSnapshot.title, job.title);
    assert.equal(pending.body.data[0].canConfirm, false);
    assert.equal(pending.body.data[0].firstOpenedAt, null);
    assert.equal(pending.body.data[0].output, undefined, 'history must not expose resume content');
    assert.deepEqual(pending.body.summary, { total: 1, opened: 1, applied: 0 });
    assert.equal((await request('/api/user/applications?status=opened')).body.data.length, 1);
    assert.equal((await request('/api/user/applications?status=applied')).body.data.length, 0);
    assert.equal((await request('/api/user/applications', { owner: otherUser })).body.data.length, 1, 'owners see only their own resume');
  }
  await TailoredResume.updateOne({ user, job: jobId }, { $set: { status: 'queued' } });
  await TailoredResume.updateOne({ user, job: jobId }, { $set: { status: 'failed' } });
  await TailoredResume.updateOne({ user, job: jobId }, { $set: { status: 'completed', output: { summary: 'My tailored resume' } } });
  await TailoredResume.updateOne({ user, job: jobId }, { $set: { outputFormat: 'latex-pdf', generationId: 'my-completed-generation' } });
  const first = await request(`/api/jobs/${jobId}/click`, { method: 'POST' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.application.status, 'opened');
  const id = first.body.data.application._id;
  await Promise.all(Array.from({ length: 5 }, () => recordApplicationOpen(user, job)));
  assert.equal(await Application.countDocuments({ user, job: jobId }), 1);
  // Each user gets a distinct record for the same job, including racing first opens.
  await Promise.all(Array.from({ length: 5 }, () => recordApplicationOpen(otherUser, job)));
  assert.equal(await Application.countDocuments({ user: otherUser, job: jobId }), 1);
  assert.equal((await request(`/api/user/applications/${id}/applied`, { method: 'PUT', owner: otherUser })).status, 404);
  assert.equal((await request(`/api/user/applications/${id}/applied`, { method: 'PUT', includeCsrf: false })).status, 403);
  const confirmed = await request(`/api/user/applications/${id}/applied`, { method: 'PUT' });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.status, 'applied');
  assert.ok(confirmed.body.data.appliedAt);
  const again = await request(`/api/jobs/${jobId}/click`, { method: 'POST' });
  assert.equal(again.body.data.application.status, 'applied');
  assert.equal(again.body.data.application.appliedAt, confirmed.body.data.appliedAt);
  assert.equal((await Job.findById(jobId)).clickCount, 1, 'duplicate tracking keeps analytics deduplication');
  const repeated = await request(`/api/user/applications/${id}/applied`, { method: 'PUT' });
  assert.equal(repeated.body.data.appliedAt, confirmed.body.data.appliedAt);
  const stageCommand = { stage: 'interview', expectedVersion: repeated.body.data.version, eventKey: 'http-interview', note: 'Interview on Tuesday' };
  const stagePath = `/api/user/applications/${id}/stage`;
  assert.equal((await request(stagePath, { method: 'PUT', includeCsrf: false, body: stageCommand })).status, 403);
  assert.equal((await request(stagePath, { method: 'PUT', owner: otherUser, body: stageCommand })).status, 404);
  assert.equal((await request(stagePath, { method: 'PUT', body: { ...stageCommand, actor: 'system' } })).status, 400);
  const progressed = await request(stagePath, { method: 'PUT', body: stageCommand });
  assert.equal(progressed.status, 200); assert.equal(progressed.body.data.stage, 'interview');
  assert.equal(progressed.body.data.status, 'applied');
  assert.equal((await request(stagePath, { method: 'PUT', body: { ...stageCommand, stage: 'offer', eventKey: 'stale-http' } })).status, 409);
  assert.equal((await request(`/api/user/applications/${id}/events`, { owner: otherUser })).status, 404);
  assert.equal((await request(`/api/user/applications/${id}/events`, { owner: null })).status, 401);
  assert.equal((await request(`/api/user/applications/${id}/events?page=bad`)).status, 400);
  const timeline = await request(`/api/user/applications/${id}/events`);
  assert.equal(timeline.status, 200);
  const stageEvent = timeline.body.data.find(event => event.kind === 'stage_changed');
  assert.equal(stageEvent.note, 'Interview on Tuesday'); assert.equal(stageEvent.actor, 'candidate'); assert.equal(stageEvent.actorUser, String(user));
  await TailoredResume.updateOne({ user, job: jobId }, { $set: { status: 'queued' } });
  const regenerating = await request('/api/user/applications');
  assert.equal(regenerating.body.data.length, 1, 'regeneration must not duplicate an application');
  assert.equal(regenerating.body.data[0].status, 'applied');
  assert.equal(regenerating.body.data[0].resumeStatus, 'queued');
  assert.equal(regenerating.body.data[0].appliedAt, confirmed.body.data.appliedAt);
  await Job.deleteOne({ _id: jobId });
  assert.equal((await request(`/api/user/applications/${id}/events`)).body.pagination.total, timeline.body.pagination.total);
  const history = await request('/api/user/applications?status=applied&page=1');
  assert.equal(history.body.data.length, 1);
  assert.equal(history.body.data[0].jobSnapshot.title, job.title);
  assert.deepEqual(history.body.summary, { total: 1, opened: 0, applied: 1 });
  const legacyJob = new mongoose.Types.ObjectId();
  await Application.create({ user, job: legacyJob, status: 'applied', jobSnapshot: job });
  for (const status of ['all', 'opened', 'applied']) {
    const filtered = await request(`/api/user/applications?status=${status}&page=1`);
    assert.deepEqual(filtered.body.summary, { total: 1, opened: 0, applied: 1 });
    assert.equal(filtered.body.pagination.total, status === 'opened' ? 0 : 1);
    assert.equal(filtered.body.data.length, status === 'opened' ? 0 : 1);
    assert.ok(filtered.body.data.every(item => item.job === String(jobId)), 'Legacy click-only records stay outside the tracker');
  }
  const queuedJobs = Array.from({ length: 21 }, (_, index) => ({ ...job, _id: new mongoose.Types.ObjectId(), fingerprint: `queued-${index}` }));
  await Job.collection.insertMany(queuedJobs);
  await TailoredResume.collection.insertMany(queuedJobs.map(listing => ({
    _id: `${user}:${listing._id}`, user, job: listing._id, status: 'queued', requestedAt: new Date(), output: null,
  })));
  const secondPage = await request('/api/user/applications?page=2');
  assert.equal(secondPage.body.data.length, 2);
  assert.deepEqual(secondPage.body.summary, { total: 22, opened: 21, applied: 1 });
  assert.equal(secondPage.body.pagination.totalPages, 11);
  const pendingPage = await request('/api/user/applications?status=opened');
  assert.equal(pendingPage.body.data.length, 2);
  assert.equal(pendingPage.body.pagination.total, 21);
  assert.ok(pendingPage.body.data.every(item => item.resumeStatus === 'queued'));
});
