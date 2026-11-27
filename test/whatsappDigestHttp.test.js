import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import SiteSettings from '../src/models/SiteSettings.js';

Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'whatsapp-digest-test-secret-at-least-32-characters',
  CORS_ORIGIN: 'http://localhost:5173', FRONTEND_ORIGIN: 'https://www.jobverify.in' });
const { createApp } = await import('../src/app.js');

test('daily digest HTTP access is admin-only, private, bounded and limited to currently public available jobs', { timeout: 90_000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { monitorCommands: true });
  await Job.init();
  const digestQueries = [];
  mongoose.connection.getClient().on('commandStarted', event => {
    if (event.commandName === 'find' && event.command.find === Job.collection.name) {
      digestQueries.push(event.command);
    }
  });
  const admin = await User.create({ email: 'digest-admin@example.test', role: 'admin', isVerified: true });
  const member = await User.create({ email: 'digest-member@example.test', isVerified: true });
  await SiteSettings.create({ _id: 'global', experiencedJobsEnabled: false });
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/whatsapp-digest`;
  const request = async (query = '', user = admin) => {
    const response = await fetch(base + query, { headers: {
      ...(user ? { cookie: `jobverify_token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}` } : {}),
    } });
    return { response, body: await response.json() };
  };
  assert.equal((await request('', null)).response.status, 401);
  assert.equal((await request('', member)).response.status, 403);
  assert.equal((await request('?date=2026-02-30')).response.status, 400);
  assert.equal((await request('?limit=50000')).response.status, 400);

  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const description = 'Build reliable software applications with the engineering team. Develop, test and maintain services, review code and collaborate with colleagues on customer features.';
  const fixtures = [
    ['eligible', {}], ['another', {}], ['hidden', { status: 'hidden' }],
    ['expired', { closingDate: new Date(Date.now() - 60_000) }],
    ['closed', { sourceAvailability: { state: 'closed' } }],
    ['experienced', { jobType: 'Full-time Experienced', experienceLevel: 'Senior Level', experience: '5 years' }],
    ['experienced-text', { jobType: 'Full-time Fresher', experienceRequired: '3 years', experienceLevel: 'Entry Level' }],
    ['contract', { jobType: 'Full-time Fresher', employmentType: 'Contract' }],
    ['outside-india', { city: 'London', country: 'United Kingdom', location: 'London, United Kingdom' }],
    ['old', { createdAt: new Date('2020-01-01T00:00:00Z') }],
    ['multi-location', { city: null, location: null, locations: ['Pune, India', 'Bengaluru, India'] }],
    // These newer rows must be skipped before applying the selected job limit.
    ['workday-gone', { sourceUrl: 'https://example.wd1.myworkdayjobs.com/jobs/job/IN/gone', workdayApplicationStatus: 'unavailable', workdayApplicationStatusCheckedAt: new Date() }],
    ['workday-maintenance', { sourceUrl: 'https://example.wd1.myworkdayjobs.com/jobs/job/IN/maintenance', workdayApplicationStatus: 'temporarily_unavailable', workdayApplicationStatusCheckedAt: new Date() }],
    ['no-application', { sourceUrl: null, applyUrl: null }],
  ];
  for (const [key, overrides] of fixtures) await Job.create({ title: `Software Engineer ${key}`, company: 'Example', city: 'Pune', country: 'India', location: 'Pune, India',
    jobType: 'Intern', fingerprint: `digest-${key}`, status: 'active', postedAt: new Date(),
    sourceUrl: `https://careers.example.test/${key}`, sourceDescription: description, description, ...overrides });

  // More than one query batch of unavailable rows, including equal timestamps,
  // must not hide older available jobs or consume the requested result limit.
  const tiedCreatedAt = new Date();
  // Its earlier ID places this available row after the 105 unavailable rows
  // at the same timestamp, exercising the ID tie-break across query pages.
  await Job.collection.updateOne({ fingerprint: 'digest-multi-location' }, { $set: { createdAt: tiedCreatedAt } });
  await Job.create(Array.from({ length: 105 }, (_, index) => ({
    title: `Unavailable Engineer ${index}`, company: 'Example', city: 'Pune', country: 'India', location: 'Pune, India',
    jobType: 'Intern', fingerprint: `digest-unavailable-${index}`, status: 'active', postedAt: tiedCreatedAt,
    createdAt: tiedCreatedAt, sourceUrl: null, applyUrl: null, sourceDescription: description, description,
  })));
  const result = await request(`?date=${today}&limit=1`);
  assert.equal(result.response.status, 200);
  assert.ok(digestQueries.length >= 2, 'eligible jobs must be found beyond the first database batch');
  for (const command of digestQueries) {
    assert.equal(command.limit, 100, 'bound the sort memory before opening a cursor');
    assert.deepEqual(command.hint, { createdAt: -1 }, 'use the existing date index instead of multiplanning broad visibility indexes');
  }
  assert.match(result.response.headers.get('cache-control'), /no-store/);
  assert.equal(result.body.data.date, today);
  assert.equal(result.body.data.timezone, 'Asia/Kolkata');
  assert.equal(result.body.data.limit, 1);
  assert.equal(result.body.data.jobs.length, 1);
  assert.equal(result.body.data.jobs[0].title, 'Software Engineer multi-location');
  assert.equal(result.body.data.hasMore, true);
  const full = await request(`?date=${today}&limit=20`);
  assert.equal(full.body.data.jobs.length, 4);
  assert.equal(full.body.data.hasMore, false);
  assert.deepEqual(full.body.data.jobs.map(row => row.title).sort(), ['Software Engineer another', 'Software Engineer contract', 'Software Engineer eligible', 'Software Engineer multi-location']);
  assert.equal(full.body.data.jobs.find(row => row.title === 'Software Engineer contract').jobType, 'Contract');
  assert.equal(full.body.data.jobs.find(row => row.title === 'Software Engineer multi-location').location, 'Pune [India], Bengaluru [India]');
  assert.equal(full.body.data.posts.length, 1);
  await SiteSettings.updateOne({ _id: 'global' }, { $set: { experiencedJobsEnabled: true } });
  const withExperienced = await request(`?date=${today}&limit=20`);
  assert.equal(withExperienced.body.data.jobs.find(row => row.title === 'Software Engineer experienced-text').jobType, 'Full-time Experienced');
  assert.equal((await request('?date=2020-01-02')).body.data.posts.length, 0);
});
