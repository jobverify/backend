import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import CandidateEvidence from '../src/models/CandidateEvidence.js';
import CVRevision from '../src/models/CVRevision.js';
import ResumeArtifact from '../src/models/ResumeArtifact.js';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { recordApplicationOpen } from '../src/services/applicationService.js';
import { mutateCandidateEvidence } from '../src/services/candidateEvidenceService.js';
import { removeUserAccount } from '../src/services/userAccountDeletion.js';
import { seedCandidateWorkflowCv } from '../scripts/lib/candidateWorkflowCvFixture.js';

test('account deletion removes the evidence, timeline and retained CV history for only its owner', { timeout: 60000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User, Job, Application, ApplicationEvent, CandidateEvidence, CVRevision, ResumeArtifact, Resume, TailoredResume].map(Model => Model.init()));
  const job = await Job.create({ title: 'React Engineer', company: 'Example', city: 'Bengaluru', location: 'Bengaluru, India',
    isPublicIndia: true, status: 'active', sourceUrl: 'https://example.com/jobs/test', description: 'Build React applications.', fingerprint: 'private-cleanup-fixture' });
  const owners = [];
  for (const email of ['first@example.edu', 'second@example.edu']) {
    const user = await User.create({ email, savedJobs: [job._id] }); owners.push(user);
    await recordApplicationOpen(user._id, job.toObject());
    await mutateCandidateEvidence(user._id, { collection: 'experiences', action: 'create', body: { version: 0, kind: 'project', role: 'Task manager', skills: ['React'] } });
    await seedCandidateWorkflowCv({ userId: user._id, jobId: job._id });
  }
  const Models = [Application, ApplicationEvent, CandidateEvidence, CVRevision, ResumeArtifact, Resume, TailoredResume];
  const counts = await Promise.all(Models.map(Model => Model.countDocuments({ user: owners[1]._id })));
  assert.ok(counts.every(value => value > 0));
  await removeUserAccount(owners[0]);
  for (const [index, Model] of Models.entries()) {
    assert.equal(await Model.countDocuments({ user: owners[0]._id }), 0, `${Model.modelName} private rows must be removed`);
    assert.equal(await Model.countDocuments({ user: owners[1]._id }), counts[index], `${Model.modelName} other-owner rows must remain`);
  }
  assert.equal(await User.countDocuments({ _id: owners[0]._id }), 0);
  assert.equal(await Job.countDocuments({ _id: job._id }), 1);
});
