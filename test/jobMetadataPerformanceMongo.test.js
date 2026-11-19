import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';

const response = () => ({
  statusCode: 200, headers: {}, body: null,
  status(code) { this.statusCode = code; return this; },
  set(name, value) { this.headers[name] = value; return this; },
  json(body) { this.body = body; return this; },
});

test('scoped metadata avoids repeated database scans while preserving filter options and access', { timeout: 120_000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false, monitorCommands: true });
  t.mock.timers.enable({ apis: ['Date'], now: +new Date('2026-11-19T12:00:00Z') });
  const { getJobMeta } = await import('../src/controllers/jobController.js');
  const row = (jobId, changes = {}) => ({
    jobId, fingerprint: jobId, source: 'metadata-performance-test', title: 'Engineering Intern',
    company: 'Alpha', companyKey: 'alpha', city: 'Bangalore', locationKeys: ['bangalore'],
    isPublicIndia: true, status: 'active', jobType: 'Internship', experienceYears: [0],
    sourceDescription: 'Build software and maintain production systems.',
    primaryRoleDomain: 'Software Engineering', workArrangement: 'Remote',
    postedAt: new Date('2026-11-19T09:00:00Z'), sortDate: new Date('2026-11-19T09:00:00Z'),
    ...changes,
  });
  await Job.collection.insertMany([
    row('base'),
    row('alternative-city', { city: 'Pune', locationKeys: ['pune'] }),
    row('alternative-type', { title: 'Software Engineer', jobType: 'Full-time Experienced',
      employmentType: 'Full-time', experienceLevel: 'Mid Level', experienceRequired: '3 years', experienceYears: [3] }),
    row('alternative-company', { company: 'Beta', companyKey: 'beta' }),
    row('alternative-arrangement', { workArrangement: 'Hybrid' }),
    row('alternative-role', { primaryRoleDomain: 'Data Science & AI' }),
    row('yesterday', { postedAt: new Date('2026-11-18T09:00:00Z') }),
    row('last-week', { postedAt: new Date('2026-11-10T09:00:00Z') }),
    row('last-month', { postedAt: new Date('2026-10-28T09:00:00Z') }),
    row('closed', { company: 'Closed', companyKey: 'closed', closingDate: new Date('2026-11-19T11:00:00Z') }),
    row('future', { company: 'Future', companyKey: 'future', postedAt: new Date('2026-11-20T09:00:00Z') }),
    row('foreign', { company: 'Foreign', companyKey: 'foreign', isPublicIndia: false }),
    row('missing-source', { company: 'Missing', companyKey: 'missing', sourceDescription: '' }),
  ]);
  let commands = [];
  mongoose.connection.getClient().on('commandStarted', event => {
    if (event.command.aggregate === 'jobs' || event.command.distinct === 'jobs' || event.command.count === 'jobs') {
      commands.push(event.commandName);
    }
  });
  const settings = { billingEnabled: false, experiencedJobsEnabled: true };
  const query = { company: 'Alpha', city: 'Bangalore', jobType: 'Intern', workArrangement: 'Remote', datePostedDays: '0' };
  const read = async (selection = query, siteSettings = settings) => {
    const res = response();
    await getJobMeta({ query: selection, siteSettings }, res);
    return res;
  };

  const initial = await read();
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.body.data.companies, ['Alpha', 'Beta']);
  assert.equal(initial.body.data.companyCount, 2);
  assert.deepEqual(initial.body.data.cities, ['Bangalore', 'Pune']);
  assert.deepEqual(initial.body.data.jobTypes, ['Full-time Experienced', 'Intern']);
  assert.deepEqual(initial.body.data.experienceYears, [0]);
  assert.deepEqual(initial.body.data.roleDomains, ['Software Engineering', 'Data Science & AI']);
  assert.deepEqual(initial.body.data.workArrangements, ['Remote', 'Hybrid']);
  assert.deepEqual(initial.body.data.datePostedOptions, [0, 1, 'this-week', 'last-week', 'this-month', 'last-month']);
  assert.deepEqual(commands, ['aggregate'], 'one metadata request must use one jobs command');

  commands = [];
  const repeated = await Promise.all([read(), read({ ...query }), read(Object.fromEntries(Object.entries(query).reverse()))]);
  for (const res of repeated) assert.deepEqual(res.body, initial.body);
  assert.deepEqual(commands, [], 'equivalent filter reads must reuse the completed cache');

  const denied = await read(query, { ...settings, billingEnabled: true });
  assert.equal(denied.statusCode, 403, 'a cached response must never bypass premium authorization');
  assert.deepEqual(commands, []);

  const restricted = await read(query, { ...settings, experiencedJobsEnabled: false });
  assert.deepEqual(restricted.body.data.jobTypes, ['Intern'], 'visibility settings must partition metadata');
  assert.deepEqual(commands, ['aggregate']);

  commands = [];
  const different = await read({ ...query, company: 'Beta' });
  assert.deepEqual(different.body.data.cities, ['Bangalore']);
  assert.deepEqual(different.body.data.jobTypes, ['Intern']);
  assert.deepEqual(different.body.data.workArrangements, ['Remote']);
  assert.deepEqual(commands, ['aggregate'], 'different selections must not collide');

  t.mock.timers.tick(30_001);
  commands = [];
  const expired = await Promise.all([read(), read(), read()]);
  for (const res of expired) assert.equal(res.statusCode, 200);
  assert.deepEqual(commands, ['aggregate'], 'expired concurrent requests must share their new query');

  commands = [];
  const missing = await read({ ...query, company: 'No Such Company' });
  assert.equal(missing.statusCode, 200);
  assert.deepEqual(missing.body.data.cities, []);
  assert.deepEqual(missing.body.data.jobTypes, []);
  assert.deepEqual(missing.body.data.datePostedOptions, []);
  assert.deepEqual(missing.body.data.companies, ['Alpha', 'Beta'], 'company options exclude their own selection even with no results');
  assert.deepEqual(commands, ['aggregate']);
});
