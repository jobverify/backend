import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import CandidateEvidence from '../src/models/CandidateEvidence.js';
import { createCsrfProtection } from '../src/middleware/csrfProtection.js';
import { getCandidateEvidenceSnapshot, lockCandidateEvidenceSnapshot, mutateCandidateEvidence } from '../src/services/candidateEvidenceService.js';

test('candidate evidence HTTP workflow and publication fences use real MongoDB', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'candidate-evidence-test-secret-local-only';
  const { default: candidateEvidenceRoutes } = await import('../src/routes/candidateEvidenceRoutes.js');
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'candidate_evidence_test' });
  await CandidateEvidence.init();
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use(createCsrfProtection({ allowedOrigins: ['http://localhost:5173'], allowDevLoopback: true }));
  app.use('/api/user/candidate-evidence', candidateEvidenceRoutes);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/user/candidate-evidence`;
  const createOwner = async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: `${id}@example.test`, role: 'user', sessionVersion: 0 });
    return id;
  };
  const request = async (owner, path = '', { method = 'GET', body, csrf = true } = {}) => {
    const response = await fetch(`${base}${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: {
      'Content-Type': 'application/json', Origin: 'http://localhost:5173',
      Cookie: `jobverify_csrf=local-test-csrf; ${owner ? `jobverify_token=${jwt.sign({ id: String(owner), sessionVersion: 0 }, process.env.JWT_SECRET)}` : ''}`,
      ...(csrf ? { 'X-CSRF-Token': 'local-test-csrf' } : {}),
    } });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  const experience = { kind: 'project', company: 'Independent', role: 'Accessibility dashboard', startDate: '2025-01-01', endDate: '2025-06-30', current: false, summary: 'Built a dashboard for keyboard users.', skills: ['React', ' SQL ', 'react'] };
  const achievement = { claim: 'Reduced report latency', context: 'Optimized reporting queries', metrics: 'From 4 seconds to 1 second', skills: ['SQL'], sourceRef: 'Project benchmark notes' };

  await t.test('authenticated CRUD persists normalized facts, protects provenance, and keeps owners isolated', async () => {
    const owner = await createOwner(); const other = await createOwner();
    assert.equal((await request(null)).status, 401);
    const empty = await request(owner);
    assert.equal(empty.cache, 'no-store'); assert.equal(empty.body.data.version, 0);
    assert.deepEqual(empty.body.data.experiences, []);
    assert.equal(empty.body.data.hash, (await getCandidateEvidenceSnapshot(other)).hash);
    assert.equal((await request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience }, csrf: false })).status, 403);
    const created = await request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.version, 1); assert.notEqual(created.body.data.hash, empty.body.data.hash);
    const row = created.body.data.experiences[0];
    assert.deepEqual(row.skills, ['React', 'SQL']);
    assert.equal((await request(other)).body.data.experiences.length, 0);
    assert.equal((await request(other, `/experiences/${row.id}`, { method: 'PUT', body: { version: 0, ...experience } })).status, 404);
    assert.equal((await request(owner, '/achievements', { method: 'POST', body: { version: 1, ...achievement, experienceId: row.id, provenance: 'cv_import' } })).status, 400);
    const added = await request(owner, '/achievements', { method: 'POST', body: { version: 1, ...achievement, experienceId: row.id } });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    const fact = added.body.data.achievements[0];
    assert.equal(fact.provenance, 'manual'); assert.equal(fact.confirmed, true);
    const edited = await request(owner, `/experiences/${row.id}`, { method: 'PUT', body: { version: 2, ...experience, role: 'Reporting dashboard' } });
    assert.equal(edited.status, 200); assert.equal(edited.body.data.experiences[0].role, 'Reporting dashboard');
    const editFact = await request(owner, `/achievements/${fact.id}`, { method: 'PUT', body: { version: 3, ...achievement, claim: 'Reduced measured report latency', experienceId: row.id } });
    assert.equal(editFact.status, 200); assert.equal(editFact.body.data.achievements[0].claim, 'Reduced measured report latency');
    assert.equal((await request(owner)).body.data.version, 4);
    const removed = await request(owner, `/experiences/${row.id}`, { method: 'DELETE', body: { version: 4 } });
    assert.equal(removed.status, 200); assert.equal(removed.body.data.experiences.length, 0);
    assert.equal(removed.body.data.achievements[0].experienceId, null, 'Deleting an experience preserves its achievements as unlinked facts');
    const deleteFact = await request(owner, `/achievements/${fact.id}`, { method: 'DELETE', body: { version: 5 } });
    assert.equal(deleteFact.status, 200); assert.deepEqual(deleteFact.body.data.achievements, []);
  });

  await t.test('concurrent initial edits have one winner and stale writes cannot overwrite or delete it', async () => {
    const owner = await createOwner();
    const attempts = await Promise.all([1, 2].map(n => request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience, role: `Project ${n}` } })));
    assert.deepEqual(attempts.map(x => x.status).sort(), [201, 409]);
    const winner = attempts.find(x => x.status === 201).body.data;
    const stale = attempts.find(x => x.status === 409);
    assert.equal(stale.body.code, 'EVIDENCE_VERSION_CONFLICT');
    assert.equal(stale.body.currentVersion, 1);
    assert.equal((await request(owner, `/experiences/${winner.experiences[0].id}`, { method: 'DELETE', body: { version: 0 } })).status, 409);
    assert.equal((await request(owner)).body.data.experiences.length, 1);
  });

  await t.test('malformed fields, cross-bank references and bank limits fail without advancing the version', async () => {
    const owner = await createOwner();
    for (const invalid of [
      { ...experience }, { version: -1, ...experience }, { version: '0', ...experience },
      { version: 0, ...experience, skills: 'React' }, { version: 0, ...experience, kind: 'other' },
      { version: 0, ...experience, summary: 'x'.repeat(2001) }, { version: 0, ...experience, role: '' },
      { version: 0, ...experience, startDate: '2025-02-30' }, { version: 0, ...experience, endDate: '2024-01-01' },
      { version: 0, ...experience, user: String(await createOwner()) },
    ]) assert.equal((await request(owner, '/experiences', { method: 'POST', body: invalid })).status, 400, JSON.stringify(invalid));
    assert.equal((await request(owner, '/achievements', { method: 'POST', body: { version: 0, ...achievement, experienceId: String(new mongoose.Types.ObjectId()) } })).status, 400);
    assert.equal((await request(owner)).body.data.version, 0);
    await CandidateEvidence.create({ _id: owner, user: owner, version: 0, experiences: Array.from({ length: 50 }, (_, n) => ({ ...experience, skills: ['React'], id: String(new mongoose.Types.ObjectId()), role: `Project ${n}` })) });
    const bounded = await request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience } });
    assert.equal(bounded.status, 400); assert.match(bounded.body.message, /50/);
    assert.equal((await request(owner)).body.data.version, 0);
  });

  await t.test('unconfirmed inferred facts remain editable but cannot influence CV facts or explained matches', async () => {
    const owner = await createOwner(); const factId = String(new mongoose.Types.ObjectId());
    const created = await request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience } });
    const experienceId = created.body.data.experiences[0].id;
    await CandidateEvidence.updateOne({ _id: owner }, { $push: { achievements: { id: factId, experienceId, claim: 'Led a Rust migration', context: '', metrics: '', skills: ['Rust'], provenance: 'agent_inferred', sourceRef: 'CV suggestion', confirmed: false } } });
    const bank = (await request(owner)).body.data;
    assert.equal(bank.achievements[0].provenance, 'agent_inferred');
    const snapshot = await getCandidateEvidenceSnapshot(owner);
    assert.deepEqual(snapshot.skills, ['React', 'SQL']); assert.deepEqual(snapshot.achievements, []);
    const now = new Date();
    const common = { company: 'Local fixture', city: 'Bengaluru', country: 'India', isPublicIndia: true, jobType: 'Full-time Experienced', postedAt: now, sortDate: now, sourceDescription: 'Build accessible reporting tools using React, SQL and Rust.', status: 'active' };
    const jobs = await Job.collection.insertMany([
      { ...common, title: 'Frontend engineer', fingerprint: 'evidence-front', requiredSkills: ['React', 'Rust'] },
      { ...common, title: 'Rust engineer', fingerprint: 'evidence-rust', requiredSkills: ['Rust'] },
      { ...common, title: 'Expired engineer', fingerprint: 'evidence-expired', requiredSkills: ['React'], status: 'expired' },
      { ...common, title: 'Hidden engineer', fingerprint: 'evidence-hidden', requiredSkills: ['React'], status: 'hidden' },
      { ...common, title: 'Closed engineer', fingerprint: 'evidence-closed', requiredSkills: ['React'], closingDate: new Date(now.getTime() - 1000) },
      { ...common, title: 'Unclassified engineer', fingerprint: 'evidence-unclassified', requiredSkills: ['React'], jobType: 'Unspecified' },
    ]);
    const matches = await request(owner, '/matches');
    assert.equal(matches.status, 200, JSON.stringify(matches.body));
    assert.equal(matches.body.data.evidenceVersion, 1);
    assert.equal(matches.body.data.matches.length, 1);
    const match = matches.body.data.matches[0];
    assert.equal(match.job.id, String(jobs.insertedIds[0]));
    assert.deepEqual(match.matchedSkills, ['React']); assert.deepEqual(match.missingSkills, ['Rust']);
    assert.equal(match.evidence[0].experienceId, experienceId);
    assert.equal(match.score, undefined, 'Literal evidence coverage is not a fabricated AI score');
    assert.equal((await request(owner, '/matches?limit=500')).status, 400);
    const confirmed = await request(owner, `/achievements/${factId}`, { method: 'PUT', body: { version: 1, claim: 'Led a Rust migration', context: '', metrics: '', skills: ['Rust'], sourceRef: 'CV suggestion', experienceId, confirmed: true } });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.data.achievements[0].provenance, 'agent_inferred');
    const published = await getCandidateEvidenceSnapshot(owner);
    assert.equal(published.achievements[0].claim, 'Led a Rust migration');
    assert.ok(published.skills.includes('Rust')); assert.notEqual(published.hash, snapshot.hash);
    const updatedMatches = (await request(owner, '/matches')).body.data.matches;
    assert.equal(updatedMatches.length, 2);
    assert.equal(updatedMatches.find(x => x.job.id === String(jobs.insertedIds[1])).evidence[0].claim, 'Led a Rust migration');
  });

  await t.test('snapshot publication fences reject stale evidence and roll back with the surrounding transaction', async () => {
    const owner = await createOwner(); const empty = await getCandidateEvidenceSnapshot(owner);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => { await lockCandidateEvidenceSnapshot(owner, empty, { session }); });
      assert.equal((await getCandidateEvidenceSnapshot(owner)).hash, empty.hash);
      const original = await CandidateEvidence.findById(owner).lean();
      await assert.rejects(session.withTransaction(async () => { await lockCandidateEvidenceSnapshot(owner, empty, { session }); throw new Error('rollback fixture'); }), /rollback fixture/);
      assert.equal((await CandidateEvidence.findById(owner).lean()).generationFence, original.generationFence);
      await request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience } });
      await assert.rejects(session.withTransaction(async () => { await lockCandidateEvidenceSnapshot(owner, empty, { session }); }), error => error.status === 409 && error.code === 'EVIDENCE_VERSION_CONFLICT');
    } finally { await session.endSession(); }
  });

  await t.test('an edit authorized before account deletion cannot recreate evidence after cleanup', async () => {
    const owner = await createOwner();
    const session = await mongoose.startSession(); let deletionStarted = false;
    try {
      await assert.rejects(session.withTransaction(async () => {
        // Establish the snapshot that a request authorized before deletion saw.
        await User.findById(owner).session(session).lean();
        if (!deletionStarted) {
          deletionStarted = true;
          await User.updateOne({ _id: owner }, { $set: { accountDeletingAt: new Date() } });
          await CandidateEvidence.deleteMany({ user: owner });
        }
        await mutateCandidateEvidence(owner, { collection: 'experiences', action: 'create', body: { version: 0, ...experience } }, { session });
      }), error => error.status === 401);
      assert.equal(await CandidateEvidence.countDocuments({ user: owner }), 0);
      const inactive = await createOwner();
      await User.updateOne({ _id: inactive }, { $set: { deactivated: true } });
      await assert.rejects(mutateCandidateEvidence(inactive, { collection: 'experiences', action: 'create', body: { version: 0, ...experience } }), error => error.status === 401);
      assert.equal(await CandidateEvidence.countDocuments({ user: inactive }), 0);
    } finally { await session.endSession(); }
  });

  await t.test('legacy version-zero sessions can edit while revoked sessions cannot write', async () => {
    const owner = await createOwner();
    await User.updateOne({ _id: owner }, { $unset: { sessionVersion: 1 } });
    const response = await request(owner, '/experiences', { method: 'POST', body: { version: 0, ...experience } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    await User.updateOne({ _id: owner }, { $set: { sessionVersion: 1 } });
    await assert.rejects(mutateCandidateEvidence(owner, { collection: 'achievements', action: 'create', body: { version: 1, ...achievement } }, { sessionVersion: 0 }), error => error.status === 401);
    assert.equal((await getCandidateEvidenceSnapshot(owner)).version, 1);
  });

  await t.test('an evidence edit after the publication snapshot forces retry and rejects the stale generation', async () => {
    const owner = await createOwner();
    await mutateCandidateEvidence(owner, { collection: 'experiences', action: 'create', body: { version: 0, ...experience } });
    const expected = await getCandidateEvidenceSnapshot(owner);
    const session = await mongoose.startSession(); let attempts = 0;
    try {
      await assert.rejects(session.withTransaction(async () => {
        attempts += 1;
        await getCandidateEvidenceSnapshot(owner, { session });
        if (attempts === 1) await mutateCandidateEvidence(owner, { collection: 'achievements', action: 'create', body: { version: 1, ...achievement } });
        await lockCandidateEvidenceSnapshot(owner, expected, { session });
      }), error => error.status === 409 && error.code === 'EVIDENCE_VERSION_CONFLICT');
      assert.ok(attempts >= 2, 'The Mongo write conflict must retry the publishing transaction');
      assert.equal((await getCandidateEvidenceSnapshot(owner)).version, 2);
    } finally { await session.endSession(); }
  });

  await t.test('match explanations remain bounded for a full bank without hiding the support count', async () => {
    const owner = await createOwner();
    await CandidateEvidence.create({ _id: owner, user: owner, version: 1, achievements: Array.from({ length: 200 }, (_, n) => ({
      id: String(new mongoose.Types.ObjectId()), claim: `Measured result ${n}`, skills: ['React'], provenance: 'manual', confirmed: true,
    })) });
    const result = await request(owner, '/matches');
    assert.equal(result.status, 200);
    const match = result.body.data.matches.find(row => row.job.title === 'Frontend engineer');
    assert.equal(match.evidenceCount, 200);
    assert.ok(match.evidence.length <= 12, 'Return at most twelve explanation examples per job');
  });
});
