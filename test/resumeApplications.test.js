import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import Job from '../src/models/Job.js';
import TailoredResume from '../src/models/TailoredResume.js';
import User from '../src/models/User.js';
import { getApplications } from '../src/controllers/applicationController.js';
import { changeApplicationStage, changeJobApplicationStage, recordApplicationOpen, recordApplicationEvidence } from '../src/services/applicationService.js';

const oid = () => new mongoose.Types.ObjectId();
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('My applications only lists confirmed applications, with optional resume details and saved outcomes', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Application.init(), ApplicationEvent.init(), TailoredResume.init()]);
  const owner = oid(); const other = oid();
  await User.collection.insertMany([{ _id: owner, email: 'resume-stages@example.test' }, { _id: other, email: 'other-resume-stages@example.test' }]);
  const listing = async () => {
    const job = { _id: oid(), fingerprint: String(oid()), title: 'Android Developer', company: 'Example', location: 'Mohali', sourceUrl: 'https://example.test/careers/android' };
    await Job.collection.insertOne(job);
    return job;
  };
  const list = async (query = {}, user = owner) => {
    const res = response();
    await getApplications({ user: { _id: user }, query }, res);
    assert.equal(res.statusCode, 200);
    return res.body;
  };
  await recordApplicationOpen(owner, await listing());
  await t.test('opening an employer page does not add a job without confirmation', async () => {
    assert.equal((await list()).data.length, 0);
    assert.equal((await list()).summary.total, 0);
  });

  const job = await listing();
  await TailoredResume.collection.insertOne({ _id: `${owner}:${job._id}`, user: owner, job: job._id, status: 'queued', requestedAt: new Date('2026-11-01T05:00:00Z') });
  await t.test('resume generation and Not applied never add an unconfirmed job to My applications', async () => {
    for (const status of ['queued', 'running', 'completed', 'failed', 'queued']) {
      await TailoredResume.updateOne({ user: owner, job: job._id }, { $set: { status } });
      const result = await list();
      assert.equal(result.data.length, 0);
      assert.deepEqual(result.summary, { total: 0, opened: 0, applied: 0 });
      assert.equal(result.pagination.total, 0);
      assert.ok(Object.values(result.stageSummary).every(count => count === 0));
    }
    assert.equal((await list({}, other)).data.length, 0);
  });

  await t.test('saved stages drive filtering and survive regeneration and job removal', async () => {
    const opened = await recordApplicationOpen(owner, job);
    const confirmed = await recordApplicationEvidence(owner, opened._id, { key: 'manual', source: 'self_reported', observedAt: new Date() });
    assert.equal((await list()).data[0].stage, 'applied');
    const saved = await changeJobApplicationStage(owner, job._id, { stage: 'expired', expectedVersion: confirmed.version, eventKey: 'resume-expired' });
    assert.equal(saved.stage, 'expired');
    assert.equal((await list({ stage: 'applied' })).data.length, 0);
    assert.equal((await list({ stage: 'expired' })).data[0].stage, 'expired');
    await TailoredResume.updateOne({ user: owner, job: job._id }, { $set: { status: 'running', requestedAt: new Date() } });
    await Job.deleteOne({ _id: job._id });
    const result = await list();
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].stage, 'expired');
    assert.equal(result.data[0].jobSnapshot.title, job.title);
    assert.equal(result.stageSummary.expired, 1);
    assert.equal(result.pagination.total, 1);
  });
  await t.test('ordering follows confirmed applications rather than resume requests or page openings', async () => {
    const user = oid();
    await User.collection.insertOne({ _id: user, email: 'resume-order@example.test' });
    const newest = await listing(); const older = await listing();
    const first = await recordApplicationOpen(user, newest, new Date('2026-01-01T05:00:00Z'));
    const second = await recordApplicationOpen(user, older, new Date('2026-02-01T05:00:00Z'));
    await recordApplicationEvidence(user, first._id, { key: 'manual', source: 'self_reported', observedAt: new Date('2026-11-01T05:00:00Z') });
    await recordApplicationEvidence(user, second._id, { key: 'manual', source: 'self_reported', observedAt: new Date('2026-10-31T05:00:00Z') });
    await TailoredResume.collection.insertMany([
      { _id: `${user}:${newest._id}`, user, job: newest._id, status: 'completed', requestedAt: new Date('2026-10-30T05:00:00Z') },
      { _id: `${user}:${older._id}`, user, job: older._id, status: 'completed', requestedAt: new Date('2026-11-01T05:00:00Z') },
    ]);
    const result = await list({}, user);
    assert.deepEqual(result.data.map(item => String(item.job)), [String(newest._id), String(older._id)]);
  });

  await t.test('confirmation without a resume adds one private application with editable outcomes', async () => {
    const user = oid();
    await User.collection.insertOne({ _id: user, email: 'confirmed-applications@example.test' });
    const job = await listing();
    const opened = await recordApplicationOpen(user, job);
    assert.equal((await list({}, user)).summary.total, 0);
    const confirmed = await recordApplicationEvidence(user, opened._id, { key: 'manual', source: 'self_reported', observedAt: new Date() });
    const result = await list({}, user);
    assert.equal(result.data.length, 1);
    assert.equal(String(result.data[0].job), String(job._id));
    assert.equal(result.data[0].stage, 'applied');
    assert.equal(result.data[0].resumeStatus, undefined);
    assert.deepEqual(result.summary, { total: 1, opened: 0, applied: 1 });
    assert.equal((await list({}, other)).summary.total, 0);

    await recordApplicationOpen(user, job);
    await recordApplicationEvidence(user, opened._id, { key: 'manual', source: 'self_reported', observedAt: new Date() });
    assert.equal((await list({}, user)).summary.total, 1);
    await TailoredResume.collection.insertOne({ _id: `${user}:${job._id}`, user, job: job._id, status: 'queued', requestedAt: new Date() });
    const combined = await list({}, user);
    assert.equal(combined.data.length, 1);
    assert.equal(combined.summary.total, 1);
    assert.equal(combined.data[0].resumeStatus, 'queued');

    let latest = await Application.findById(confirmed._id).lean();
    for (const stage of ['selected', 'rejected', 'applied']) {
      latest = await changeApplicationStage(user, latest._id, { stage, expectedVersion: latest.version, eventKey: `outcome-${stage}` });
      const filtered = await list({ stage }, user);
      assert.equal(filtered.data[0].stage, stage);
      assert.equal(filtered.stageSummary[stage], 1);
      assert.equal(filtered.summary.total, 1);
    }
    await TailoredResume.deleteOne({ user, job: job._id });
    await Job.deleteOne({ _id: job._id });
    const archived = await list({}, user);
    assert.equal(archived.data.length, 1);
    assert.equal(archived.data[0].jobSnapshot.title, job.title);
    assert.equal(archived.data[0].jobSnapshot.applicationUrl, job.sourceUrl);
  });

});
