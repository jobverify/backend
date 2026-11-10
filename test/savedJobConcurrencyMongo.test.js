import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { saveJob, removeSavedJob, getSavedJobs } from '../src/controllers/userController.js';
import { deduplicateSavedJobs } from '../scripts/deduplicateSavedJobs.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });
test('saved jobs are canonical, atomic and idempotent', { timeout: 60000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Job.init(), TailoredResume.init()]);
  const user = await User.create({ email: 'bookmarks@example.test' });
  const job = await Job.create({ title: 'Software Engineer', fingerprint: 'bookmark-race', company: 'Example',
    jobType: 'Internship', sourceDescription: 'Build reliable production software in India.',
    description: 'Build reliable production software in India.', country: 'India', city: 'Bengaluru',
    location: 'Bengaluru, India', isPublicIndia: true, status: 'active' });
  const request = jobId => ({ user, params: { jobId } });
  await t.test('uppercase ID save is idempotent and removal uses the same identity', async () => {
    for (const id of [String(job._id), String(job._id).toUpperCase()]) {
      const res = response(); await saveJob(request(id), res); assert.equal(res.statusCode, 200);
    }
    assert.equal((await User.findById(user._id)).savedJobs.length, 1);
    const removed = response(); await removeSavedJob(request(String(job._id).toUpperCase()), removed);
    assert.equal(removed.statusCode, 200);
    assert.equal((await User.findById(user._id)).savedJobs.length, 0);
  });
  await t.test('concurrent repeated saves create exactly one reference', async () => {
    await User.updateOne({ _id: user._id }, { $set: { savedJobs: [] } });
    const results = await Promise.all(Array.from({ length: 12 }, async () => {
      const res = response(); await saveJob(request(String(job._id)), res); return res;
    }));
    for (const res of results) assert.equal(res.statusCode, 200);
    assert.deepEqual((await User.findById(user._id)).savedJobs.map(String), [String(job._id)]);
  });
  await t.test('legacy duplicate references render only one card', async () => {
    await User.updateOne({ _id: user._id }, { $set: { savedJobs: [job._id, job._id] } });
    const res = response(); await getSavedJobs({ user }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.data.length, 1);
    assert.equal(res.body.profileOverview.savedJobs, 1);
    assert.deepEqual(await deduplicateSavedJobs({ model: User }), { candidates: 1, modifiedCount: 0 });
    assert.equal((await User.findById(user._id)).savedJobs.length, 2);
    assert.deepEqual(await deduplicateSavedJobs({ model: User, apply: true }), { candidates: 1, modifiedCount: 1 });
    assert.deepEqual((await User.findById(user._id)).savedJobs.map(String), [String(job._id)]);
  });
  await t.test('an unrelated legacy profile save cannot erase an atomic bookmark addition', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-bookmarks@example.test' });
    const stale = await User.findById(id);
    const res = response();
    await saveJob({ user: { _id: id }, params: { jobId: String(job._id) } }, res);
    assert.equal(res.statusCode, 200);
    stale.profile.name = 'Unrelated profile update';
    await stale.save();
    const current = await User.findById(id);
    assert.deepEqual(current.savedJobs.map(String), [String(job._id)]);
    assert.equal(current.profile.name, 'Unrelated profile update');
  });
});
