import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { readHiringSnapshot } from '../src/services/hiringObservationService.js';
import { collectPublishingGapSnapshot } from '../scripts/collectPublishingGapSnapshot.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';

const now = new Date('2026-06-20T08:00:00.000Z');
let mongo, originalFetch;

before(async () => {
  assert.equal(mongoose.connection.readyState, 0);
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network forbidden during reference-clock tests'); };
  const binaryDirectory = process.env.MONGOMS_DOWNLOAD_DIR || path.join(os.tmpdir(), 'codex-scraper-test-mongo-8.2.6');
  const localBinary = path.join(binaryDirectory, 'mongod-x64-win32-8.2.6.exe');
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY
    || (process.platform === 'win32' && existsSync(localBinary) ? localBinary : undefined);
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' }, binary: {
    version: '8.2.6', downloadDir: binaryDirectory,
    ...(systemBinary ? { systemBinary } : {}),
  } });
  const uri = mongo.getUri();
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  globalThis.fetch = originalFetch;
  assert.equal(mongoose.connection.readyState, 0);
});

test('both snapshots use the caller clock for visibility, settings, content and posting-day counts', async () => {
  const recentWallClock = new Date();
  recentWallClock.setUTCDate(recentWallClock.getUTCDate() - 1);
  const row = (jobId, postedAt, overrides = {}) => ({
    fingerprint: `clock-${jobId}`, jobId, source: 'reference-clock', title: 'Engineer', company: jobId,
    postedAt: new Date(postedAt), jobType: 'Intern', status: 'active', isPublicIndia: true,
    city: 'Bangalore', country: 'India', sourceDescription: 'Build software and maintain production systems.',
    ...overrides,
  });
  await Job.collection.insertMany([
    row('historical', '2026-06-19T10:00:00Z'),
    row('experienced', '2026-06-18T10:00:00Z', { jobType: 'Full-time Experienced',
      employmentType: 'Full-time', experienceLevel: 'Mid Level', experienceRequired: '3 years' }),
    row('cutoff', '2026-05-20T00:00:00Z'),
    row('too-old', '2026-05-19T23:59:59.999Z'),
    row('future', '2026-06-20T08:00:00.001Z'),
    row('wall-clock-only', recentWallClock),
    row('foreign', '2026-06-19', { country: 'United Kingdom', city: 'London', isPublicIndia: false }),
    row('hidden', '2026-06-19', { status: 'hidden' }),
    row('missing-source', '2026-06-19', { sourceDescription: '', description: 'Generated display summary.' }),
  ]);
  for (const experiencedJobsEnabled of [true, false]) {
    const settings = { experiencedJobsEnabled };
    const expected = experiencedJobsEnabled ? ['cutoff', 'experienced', 'historical'] : ['cutoff', 'historical'];
    await mongoose.connection.db.collection('sitesettings').updateOne({ _id: 'global' }, { $set: settings }, { upsert: true });
    const visible = await Job.find(applyPublicJobVisibility({ status: 'active' }, settings, now)).select('jobId').lean();
    assert.deepEqual(visible.map(job => job.jobId).sort(), expected);
    const direction = await readHiringSnapshot(settings, now);
    assert.equal(direction.generatedAt, now.toISOString());
    assert.equal(direction.totalJobs, expected.length);
    assert.deepEqual(direction.companies.map(company => company.label).sort(), expected);
    assert.equal(direction.daily.reduce((sum, day) => sum + day.count, 0), expected.length);
    const publishing = await collectPublishingGapSnapshot({ now });
    assert.equal(publishing.generatedAt, now.toISOString());
    assert.deepEqual(publishing.publicCompanyNames, expected);
    assert.equal(publishing.inventory[0].visibleJobs, expected.length);
  }
});

test('two-argument public visibility retains the default current clock and category policy', t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now });
  for (const experiencedJobsEnabled of [true, false]) {
    const settings = { experiencedJobsEnabled };
    assert.deepEqual(applyPublicJobVisibility({ status: 'active' }, settings),
      applyPublicJobVisibility({ status: 'active' }, settings, now));
  }
});
