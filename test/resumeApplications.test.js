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
import { changeJobApplicationStage, recordApplicationOpen, recordApplicationEvidence } from '../src/services/applicationService.js';

const oid = () => new mongoose.Types.ObjectId();
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('My applications contains only the owners tailored resume jobs and their saved stages', { timeout: 90000 }, async t => {
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
  const clickOnly = await recordApplicationOpen(owner, await listing());
  await recordApplicationEvidence(owner, clickOnly._id, { key: 'manual', source: 'self_reported', observedAt: new Date() });
  await t.test('clicks and submission confirmations do not add a job without a tailored resume', async () => {
    assert.equal((await list()).data.length, 0);
    assert.equal((await list()).summary.total, 0);
  });

  const job = await listing();
  await TailoredResume.collection.insertOne({ _id: `${owner}:${job._id}`, user: owner, job: job._id, status: 'queued', requestedAt: new Date('2026-11-01T05:00:00Z') });
  await t.test('a resume request adds one Preparing job throughout generation and retries', async () => {
    for (const status of ['queued', 'running', 'completed', 'failed', 'queued']) {
      await TailoredResume.updateOne({ user: owner, job: job._id }, { $set: { status } });
      const result = await list();
      assert.equal(result.data.length, 1);
      assert.equal(String(result.data[0].job), String(job._id));
      assert.equal(result.data[0].stage, 'preparing');
      assert.equal(result.data[0].resumeStatus, status);
      assert.equal(result.summary.total, 1);
    }
    assert.equal((await list({}, other)).data.length, 0);
  });

  await t.test('saved stages drive filtering and survive regeneration and job removal', async () => {
    const saved = await changeJobApplicationStage(owner, job._id, { stage: 'expired', expectedVersion: 0, eventKey: 'resume-expired' });
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
  await t.test('ordering follows resume requests even when an employer page was opened much earlier', async () => {
    const user = oid();
    await User.collection.insertOne({ _id: user, email: 'resume-order@example.test' });
    const newest = await listing(); const older = await listing();
    await recordApplicationOpen(user, newest, new Date('2026-01-01T05:00:00Z'));
    await TailoredResume.collection.insertMany([
      { _id: `${user}:${newest._id}`, user, job: newest._id, status: 'completed', requestedAt: new Date('2026-11-01T05:00:00Z') },
      { _id: `${user}:${older._id}`, user, job: older._id, status: 'completed', requestedAt: new Date('2026-10-31T05:00:00Z') },
    ]);
    const result = await list({}, user);
    assert.deepEqual(result.data.map(item => String(item.job)), [String(newest._id), String(older._id)]);
  });

});
