import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Application from '../src/models/Application.js';
import Job from '../src/models/Job.js';
import TailoredResume from '../src/models/TailoredResume.js';
import User from '../src/models/User.js';
import * as applicationService from '../src/services/applicationService.js';
import { getApplications } from '../src/controllers/applicationController.js';

const oid = () => new mongoose.Types.ObjectId();
const job = () => ({ _id: oid(), title: 'Engineer', company: 'Example', sourceUrl: 'https://example.test/jobs/42' });

test('application stages and durable events preserve submission, concurrency and ownership', { timeout: 120000 }, async t => {
  assert.equal(typeof applicationService.changeApplicationStage, 'function', 'Candidates need a stage mutation independent of submission confirmation');
  const { default: ApplicationEvent } = await import('../src/models/ApplicationEvent.js');
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Application.init(), ApplicationEvent.init(), Job.init(), TailoredResume.init()]);
  const user = oid(); const other = oid();
  await User.collection.insertMany([{ _id: user, email: 'stages@example.test' }, { _id: other, email: 'other-stages@example.test' }]);
  const open = async () => applicationService.recordApplicationOpen(user, job());
  const change = (row, stage, input = {}) => applicationService.changeApplicationStage(user, row._id, {
    stage, expectedVersion: row.version, eventKey: `stage-${oid()}`, ...input,
  });

  await t.test('an employer opening creates an event and preparing stage without submission evidence', async () => {
    const row = await open();
    assert.equal(row.status, 'opened'); assert.equal(row.stage, 'preparing'); assert.equal(row.appliedAt, null);
    const events = await ApplicationEvent.find({ application: row._id }).lean();
    assert.equal(events.length, 1); assert.equal(events[0].kind, 'opened');
    assert.equal(events[0].actor, 'candidate'); assert.equal(String(events[0].actorUser), String(user));
    assert.equal(events[0].source, 'employer_link'); assert.equal(events[0].newStage, 'preparing');
  });

  await t.test('all requested stages are independently editable and notes record prior/new stage', async () => {
    let row = await open();
    for (const stage of ['applied', 'screening', 'responded', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'expired', 'preparing']) {
      const previous = row.stage;
      row = await change(row, stage, { note: 'Candidate update' });
      assert.equal(row.stage, stage); assert.equal(row.status, 'opened'); assert.equal(row.appliedAt, null);
      const event = await ApplicationEvent.findOne({ application: row._id, kind: 'stage_changed', newStage: stage });
      assert.equal(event.priorStage, previous); assert.equal(event.note, 'Candidate update');
    }
  });

  await t.test('submission confirmation advances preparing but late email never regresses advanced or terminal stages', async () => {
    for (const stage of ['preparing', 'screening', 'responded', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'expired']) {
      let row = await open();
      if (stage !== 'preparing') row = await change(row, stage);
      const saved = await applicationService.recordApplicationEvidence(user, row._id, { key: 'mail-ack', source: 'email', observedAt: new Date('2026-10-01'), summary: 'Application received' });
      assert.equal(saved.status, 'applied'); assert.equal(saved.stage, stage === 'preparing' ? 'applied' : stage);
      const event = await ApplicationEvent.findOne({ application: row._id, kind: 'submission_confirmed' });
      assert.equal(event.priorStage, stage); assert.equal(event.newStage, saved.stage); assert.equal(event.source, 'email');
    }
  });

  await t.test('concurrent retries append once and stale or reused commands cannot overwrite later work', async () => {
    const initial = await open();
    const command = { stage: 'interview', expectedVersion: initial.version, eventKey: 'interview-retry', note: 'Tuesday' };
    const rows = await Promise.all(Array.from({ length: 4 }, () => applicationService.changeApplicationStage(user, initial._id, command)));
    assert.ok(rows.every(row => row.stage === 'interview'));
    assert.equal(await ApplicationEvent.countDocuments({ application: initial._id, key: 'stage:interview-retry' }), 1);
    await assert.rejects(change(initial, 'offer'), error => error.statusCode === 409);
    await assert.rejects(applicationService.changeApplicationStage(user, initial._id, { ...command, stage: 'rejected' }), error => error.statusCode === 409);
    const newer = await change(rows[0], 'offer');
    const retried = await applicationService.changeApplicationStage(user, initial._id, command);
    assert.equal(retried.stage, 'offer'); assert.equal(retried.version, newer.version);
  });

  await t.test('old evidence is still deduplicated after the summary has exceeded twenty entries', async () => {
    const row = await open();
    const evidence = index => ({ key: `email-${index}`, source: 'email', observedAt: new Date('2026-10-01'), summary: `Acknowledgement ${index}` });
    for (let index = 0; index < 23; index++) await applicationService.recordApplicationEvidence(user, row._id, evidence(index));
    await applicationService.recordApplicationEvidence(user, row._id, evidence(0));
    assert.equal((await Application.findById(row._id)).evidence.length, 20);
    assert.equal(await ApplicationEvent.countDocuments({ application: row._id, kind: 'submission_confirmed' }), 23);
  });

  await t.test('aborting the transaction rolls back stage and event together', async () => {
    const row = await open();
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await applicationService.changeApplicationStage(user, row._id, { stage: 'offer', expectedVersion: row.version, eventKey: 'rolled-back' }, { session });
        throw new Error('abort-stage');
      }), /abort-stage/);
    } finally { await session.endSession(); }
    assert.equal((await Application.findById(row._id)).stage, 'preparing');
    assert.equal(await ApplicationEvent.countDocuments({ application: row._id, key: 'stage:rolled-back' }), 0);
  });

  await t.test('timeline is paginated, owner scoped, immutable and remains after job deletion', async () => {
    const listing = job(); await Job.collection.insertOne(listing);
    let row = await applicationService.recordApplicationOpen(user, listing);
    for (let index = 0; index < 22; index++) row = await change(row, index % 2 ? 'interview' : 'screening');
    await Job.deleteOne({ _id: listing._id });
    const first = await applicationService.getApplicationTimeline(user, row._id, { page: 1 });
    const second = await applicationService.getApplicationTimeline(user, row._id, { page: 2 });
    assert.equal(first.data.length, 20); assert.equal(second.data.length, 3); assert.equal(first.pagination.total, 23);
    assert.equal(new Set([...first.data, ...second.data].map(event => String(event._id))).size, 23);
    assert.equal(first.application.jobSnapshot.title, listing.title);
    await assert.rejects(applicationService.getApplicationTimeline(other, row._id, { page: 1 }), error => error.statusCode === 404);
    await assert.rejects(applicationService.changeApplicationStage(other, row._id, { stage: 'offer', expectedVersion: row.version, eventKey: 'foreign' }), error => error.statusCode === 404);
    await assert.rejects(ApplicationEvent.updateOne({ application: row._id }, { $set: { note: 'Rewritten' } }), /append-only/i);
  });

  await t.test('legacy applied rows retain their implied stage and deduplicate existing evidence', async () => {
    const id = oid();
    await Application.collection.insertOne({ _id: id, user, job: oid(), jobSnapshot: job(), status: 'applied', appliedAt: new Date('2026-09-01'), evidence: [{ key: 'manual', source: 'self_reported', observedAt: new Date('2026-09-01') }] });
    const before = await applicationService.getApplicationTimeline(user, id, { page: 1 });
    assert.equal(before.application.stage, 'applied'); assert.equal(before.application.version, 0);
    assert.equal(before.legacyHistory, true);
    await applicationService.recordApplicationEvidence(user, id, { key: 'manual', source: 'self_reported', observedAt: new Date() });
    assert.equal(await ApplicationEvent.countDocuments({ application: id, kind: 'submission_confirmed' }), 0);
    const changed = await applicationService.changeApplicationStage(user, id, { stage: 'interview', expectedVersion: 0, eventKey: 'legacy-progress' });
    assert.equal(changed.status, 'applied');
    const event = await ApplicationEvent.findOne({ application: id });
    assert.equal(event.priorStage, 'applied');
  });

  await t.test('resume-only entries can save a stage without pretending an employer page was opened', async () => {
    const listing = job(); await Job.collection.insertOne(listing);
    await TailoredResume.collection.insertOne({ _id: `${user}:${listing._id}`, user, job: listing._id, status: 'queued' });
    const row = await applicationService.changeJobApplicationStage(user, listing._id, { stage: 'screening', expectedVersion: 0, eventKey: 'resume-stage' });
    assert.equal(row.stage, 'screening'); assert.equal(row.status, 'opened'); assert.equal(row.firstOpenedAt, null);
    assert.equal(await ApplicationEvent.countDocuments({ application: row._id, kind: 'opened' }), 0);
    await assert.rejects(applicationService.changeJobApplicationStage(other, listing._id, { stage: 'interview', expectedVersion: 0, eventKey: 'foreign-resume' }), error => error.statusCode === 404);
  });

  await t.test('malformed stages, unbounded notes and invalid versions are rejected', async () => {
    const row = await open();
    for (const bad of [{ stage: 'hired' }, { note: 'a'.repeat(2001) }, { expectedVersion: -1 }, { expectedVersion: '0' }, { eventKey: '' }, { source: 'email' }]) {
      await assert.rejects(change(row, 'offer', bad), error => error.statusCode === 400);
    }
  });

  await t.test('stage filtering and pagination use stage independently of confirmed submission', async () => {
    const owner = oid();
    await User.collection.insertOne({ _id: owner, email: 'filters@example.test' });
    let interview = await applicationService.recordApplicationOpen(owner, job());
    interview = await applicationService.changeApplicationStage(owner, interview._id, { stage: 'interview', expectedVersion: interview.version, eventKey: 'filter-interview' });
    const preparing = await applicationService.recordApplicationOpen(owner, job());
    await TailoredResume.collection.insertMany([interview, preparing].map(row => ({ _id: `${owner}:${row.job}`, user: owner, job: row.job, status: 'completed' })));
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
    const res = response();
    await getApplications({ user: { _id: owner }, query: { stage: 'interview', status: 'opened' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].stage, 'interview'); assert.equal(res.body.data[0].version, interview.version);
    assert.equal(res.body.pagination.total, 1); assert.equal(res.body.stageSummary.interview, 1);
    assert.deepEqual(res.body.summary, { total: 2, opened: 2, applied: 0 });
    const bad = response();
    await getApplications({ user: { _id: owner }, query: { stage: 'invented' } }, bad);
    assert.equal(bad.statusCode, 400);
  });

  await t.test('account deletion fences late openings, evidence and stage writes', async () => {
    const owner = oid(); await User.collection.insertOne({ _id: owner, email: 'deleting@example.test' });
    const listing = job();
    const row = await applicationService.recordApplicationOpen(owner, listing);
    await User.updateOne({ _id: owner }, { $set: { accountDeletingAt: new Date() } });
    await assert.rejects(applicationService.recordApplicationOpen(owner, listing), error => error.statusCode === 404);
    await assert.rejects(applicationService.recordApplicationEvidence(owner, row._id, { key: 'late-email', source: 'email', observedAt: new Date() }), error => error.statusCode === 404);
    await assert.rejects(applicationService.changeApplicationStage(owner, row._id, { stage: 'offer', expectedVersion: row.version, eventKey: 'late-change' }), error => error.statusCode === 404);
    assert.equal(await ApplicationEvent.countDocuments({ user: owner }), 1);
    assert.equal((await Application.findById(row._id)).stage, 'preparing');
  });

  await t.test('a transaction with a pre-deletion snapshot cannot recreate cleared application history', async () => {
    const owner = oid(); await User.collection.insertOne({ _id: owner, email: 'race-delete@example.test' });
    const listing = job(); await applicationService.recordApplicationOpen(owner, listing);
    let ready, release; let runs = 0;
    const started = new Promise(resolve => { ready = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const session = await mongoose.startSession();
    const mutation = session.withTransaction(async () => {
      if (++runs === 1) { await User.findById(owner).session(session); ready(); await gate; }
      return applicationService.recordApplicationOpen(owner, listing, new Date(), { session });
    });
    const rejected = assert.rejects(mutation, error => error.statusCode === 404);
    await started;
    await User.updateOne({ _id: owner }, { $set: { accountDeletingAt: new Date() } });
    await Application.deleteMany({ user: owner }); await ApplicationEvent.deleteMany({ user: owner });
    release();
    try { await rejected; } finally { await session.endSession(); }
    assert.equal(await Application.countDocuments({ user: owner }), 0);
    assert.equal(await ApplicationEvent.countDocuments({ user: owner }), 0);
  });
});
