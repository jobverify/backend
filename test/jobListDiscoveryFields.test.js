import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { getAllJobs, getJobSearch } from '../src/controllers/jobController.js';

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  set() { return this; },
});

test('public listing query paths retain pay, skills and source date evidence', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const now = new Date();
  const job = {
    title: 'Java Engineering Intern', company: 'Discovery Example', fingerprint: 'discovery-example',
    companyKey: 'discovery example', jobType: 'Intern', source: 'discovery-test', status: 'active',
    isPublicIndia: true, country: 'India', city: 'Bangalore', location: 'Bangalore, India', locationKeys: ['bangalore'],
    description: 'Build Java services and write SQL queries for reliable production software.',
    sourceDescription: 'Build Java services and write SQL queries for reliable production software.',
    salary: '₹30,000/month', requiredSkills: ['Java', 'SQL'], workArrangement: 'Hybrid',
    postedAt: now, employerPostedAt: now, postedAtProvenance: 'source', postedAtProvenanceValue: now.toISOString(),
    closingDate: new Date(+now + 172800000), lastSeenAt: now,
    sourceUrl: 'https://careers.example.test/jobs/42', applyUrl: 'https://careers.example.test/jobs/42/apply',
  };
  await Job.collection.insertOne(job);
  for (const [name, controller, query] of [
    ['numbered list', getAllJobs, { limit: '12', sort: 'latest' }],
    ['filtered list', getAllJobs, { limit: '12', city: 'Bangalore', sort: 'latest' }],
    ['cursor list', getJobSearch, { limit: '12', sort: 'latest' }],
  ]) await t.test(name, async () => {
    const res = response();
    await controller({ query, user: { role: 'admin' }, siteSettings: { billingEnabled: false } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
    const actual = res.body.data[0];
    assert.equal(actual.salary, job.salary);
    assert.deepEqual(actual.requiredSkills, ['Java', 'SQL']);
    assert.equal(+new Date(actual.employerPostedAt), +now);
    assert.equal(actual.postedAtProvenance, 'source');
    assert.equal(actual.postedAtProvenanceValue, now.toISOString());
    assert.equal(new Date(actual.lastSeenAt).toISOString(), now.toISOString());
    assert.equal(new Date(actual.closingDate).toISOString(), job.closingDate.toISOString());
    assert.equal(actual.sourceUrl, job.sourceUrl);
    assert.equal(Object.hasOwn(actual, 'sourceDescription'), false);
  });
});
