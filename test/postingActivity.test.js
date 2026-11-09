import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { readHiringSnapshot } from '../src/services/hiringObservationService.js';

test('live posting activity ends today in India and counts only visible current inventory', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const now = new Date('2026-10-18T20:00:00Z'); // 19 October in India.
  const fixtures = [
    { postedAt: new Date('2026-10-18T18:29:59Z') },
    { postedAt: new Date('2026-10-18T18:30:00Z'), jobType: 'Intern' },
    { postedAt: new Date('2026-10-18T19:00:00Z'), jobType: 'Full-time Fresher' },
    { postedAt: new Date('2026-10-18T19:00:00Z'), jobType: null, employmentType: 'part-time' },
    { postedAt: new Date('2026-10-18T19:00:00Z'), status: 'expired' },
    { postedAt: new Date('2026-10-18T19:00:00Z'), status: 'hidden' },
    { postedAt: new Date('2026-10-18T19:00:00Z'), closingDate: new Date('2026-10-18T19:30:00Z') },
    { postedAt: new Date('2026-10-18T19:00:00Z'), city: 'London', country: 'United Kingdom', isPublicIndia: false },
    { postedAt: new Date('2026-10-19T20:00:00Z') },
    { postedAt: null },
    { postedAt: new Date('2026-01-01') },
  ];
  await Job.collection.insertMany(fixtures.map((job, index) => ({
    fingerprint: `posting-${index}`, company: 'Acme', title: 'Software Engineer',
    jobType: 'Full-time Experienced', status: 'active', isPublicIndia: true,
    city: 'Bangalore', country: 'India', description: 'Build software with the engineering team.', ...job,
  })));
  const all = await readHiringSnapshot({ experiencedJobsEnabled: true }, now);
  assert.equal(all.daily?.length, 90);
  assert.deepEqual(all.daily.slice(-3), [
    { date: '2026-10-17', count: 0, entryLevel: 0 },
    { date: '2026-10-18', count: 1, entryLevel: 0 },
    { date: '2026-10-19', count: 2, entryLevel: 2 },
  ]);
  assert.equal(all.daily.reduce((sum, row) => sum + row.count, 0), 3);
  const earlyCareer = await readHiringSnapshot({ experiencedJobsEnabled: false }, now);
  assert.deepEqual(earlyCareer.daily.slice(-2), [
    { date: '2026-10-18', count: 0, entryLevel: 0 },
    { date: '2026-10-19', count: 2, entryLevel: 2 },
  ]);
  await Job.deleteMany({});
  const empty = await readHiringSnapshot({}, now);
  assert.equal(empty.daily.length, 90);
  assert.deepEqual(empty.daily.at(-1), { date: '2026-10-19', count: 0, entryLevel: 0 });
});
