import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import User from '../src/models/User.js';
import { recordApplicationOpen } from '../src/services/applicationService.js';

test('opening an employer page tracks intent without requiring a generated resume', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri()); await Promise.all([Application.init(), ApplicationEvent.init()]);
  const user = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: user, email: 'personal-cv@example.test' });
  const application = await recordApplicationOpen(user, { _id: new mongoose.Types.ObjectId(), title: 'Engineer', company: 'Example', sourceUrl: 'https://example.com/jobs/42' });
  assert.ok(application, 'Candidates using their own CV must have a tracked application');
  assert.equal(application.status, 'opened'); assert.equal(application.stage, 'preparing');
  assert.equal(application.appliedAt, null, 'Opening a link is not submission evidence');
  assert.equal(await ApplicationEvent.countDocuments({ application: application._id, kind: 'submission_confirmed' }), 0);
});
