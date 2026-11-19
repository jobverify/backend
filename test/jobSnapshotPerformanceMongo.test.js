import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';

test('snapshot polling reuses a bounded snapshot and isolates visibility settings', { timeout: 120_000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false, monitorCommands: true });
  t.mock.timers.enable({ apis: ['Date'], now: +new Date('2026-11-19T12:00:00Z') });
  const { getJobSnapshot } = await import('../src/controllers/jobSnapshotController.js');
  const row = (jobId, changes = {}) => ({
    jobId, fingerprint: jobId, source: 'snapshot-performance-test', title: 'Engineering Intern',
    company: 'Alpha', city: 'Bangalore', isPublicIndia: true, status: 'active', jobType: 'Intern',
    sourceDescription: 'Build software and maintain production systems.', workArrangement: 'Remote',
    postedAt: new Date('2026-11-19T09:00:00Z'), ...changes,
  });
  await Job.collection.insertMany([
    row('intern'), row('experienced', { title: 'Software Engineer', jobType: 'Full-time Experienced',
      employmentType: 'Full-time', experienceLevel: 'Mid Level', experienceRequired: '3 years' }),
  ]);
  let scans = 0;
  mongoose.connection.getClient().on('commandStarted', event => { if (event.command.aggregate === 'jobs') scans++; });
  const read = async (experiencedJobsEnabled = true) => {
    let body;
    const res = { set(name, value) { assert.equal(name, 'Cache-Control'); assert.equal(value, 'no-store'); },
      json(value) { body = value; } };
    await getJobSnapshot({ siteSettings: { experiencedJobsEnabled } }, res, error => { throw error; });
    return body.data;
  };
  const initial = await Promise.all([read(), read(), read()]);
  assert.equal(initial[0].totalJobs, 2);
  assert.equal(scans, 1);
  const generatedAt = initial[0].generatedAt;
  t.mock.timers.tick(60_001);
  const polled = await read();
  assert.equal(polled.generatedAt, generatedAt);
  assert.equal(scans, 1, 'a minute poll must not repeat the expensive snapshot scan');
  assert.equal((await read(false)).totalJobs, 1);
  assert.equal(scans, 2, 'visibility changes must never reuse the other snapshot partition');
  await Job.collection.updateOne({ jobId: 'intern' }, { $set: { status: 'hidden' } });
  t.mock.timers.tick(240_000);
  const refreshed = await read();
  assert.equal(refreshed.totalJobs, 1);
  assert.notEqual(refreshed.generatedAt, generatedAt);
  assert.equal(scans, 3, 'snapshots must refresh after five minutes');
});
