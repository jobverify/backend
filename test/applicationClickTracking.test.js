import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Click from '../src/models/Click.js';
import { trackJobClick } from '../src/controllers/jobController.js';

test('click analytics never suppress durable application opening history', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri()); await Promise.all([Application.init(), ApplicationEvent.init(), Click.init()]);
  for (const duplicate of [false, true]) await t.test(`Apply tracks intent when analytics ${duplicate ? 'deduplicates' : 'records'} the click`, async () => {
    const user = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: user, email: `click-${duplicate}@example.test` });
    const job = { _id: new mongoose.Types.ObjectId(), title: 'Engineer', company: 'Example', clickCount: 2, sourceUrl: 'https://example.com/careers/123', status: 'active', isPublicIndia: true, fingerprint: `click-${duplicate}`,
      location: 'Pune', jobType: 'Full-time Fresher', sourceDescription: 'Build applications and collaborate with engineers.', description: 'Build applications and collaborate with engineers.' };
    await Job.collection.insertOne(job);
    if (duplicate) await Click.create({ job: job._id, user, ip: '127.0.0.1' });
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await trackJobClick({ user: { _id: user }, params: { id: String(job._id) }, headers: {}, ip: '127.0.0.1' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.application.status, 'opened');
    assert.equal(res.body.data.application.appliedAt, null);
    assert.equal(await Application.countDocuments({ user, job: job._id }), 1);
    assert.equal(await ApplicationEvent.countDocuments({ user, kind: 'opened' }), 1);
    assert.equal((await Job.findById(job._id)).clickCount, duplicate ? 2 : 3);
  });
});
