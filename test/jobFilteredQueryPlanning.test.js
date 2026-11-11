import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { getAllJobs } from '../src/controllers/jobController.js';

const locationIndex = { status: 1, isPublicIndia: 1, locationKeys: 1, sortDate: -1, _id: -1 };
const companyIndex = { status: 1, isPublicIndia: 1, companyKey: 1, sortDate: -1, _id: -1 };
const companyLocationIndex = { status: 1, isPublicIndia: 1, companyKey: 1, locationKeys: 1, sortDate: -1, _id: -1 };
const dateIndex = { status: 1, isPublicIndia: 1, sortDate: -1, _id: -1 };
const popularityIndex = { status: 1, isPublicIndia: 1, clickCount: -1, sortDate: -1, _id: -1 };

const response = () => ({
  statusCode: 200, body: null, set() { return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const queryChain = exec => ({
  select() { return this; }, sort() { return this; }, skip() { return this; },
  limit() { return this; }, lean() { return this; }, exec,
});

for (const { name, query, hint } of [
  { name: 'default public page', query: {}, hint: dateIndex },
  { name: 'latest deep page', query: { page: '1851', sort: 'latest' }, hint: dateIndex },
  { name: 'oldest page', query: { sort: 'oldest' }, hint: dateIndex },
  { name: 'trending page', query: { sort: 'popularity' }, hint: popularityIndex },
  { name: 'recommended without equality keys', query: { sort: 'recommended' }, hint: undefined },
  { name: 'profile internship and city', query: { city: 'Bangalore', jobType: 'Intern', sort: 'latest' }, hint: locationIndex },
  { name: 'legacy location selection', query: { location: 'Bangalore' }, hint: locationIndex },
  { name: 'company selection', query: { company: 'Acme' }, hint: companyIndex },
  { name: 'company and city', query: { company: 'Acme', city: 'Bangalore' }, hint: companyLocationIndex },
  { name: 'multiple companies and cities', query: { company: ['Acme', 'Beta'], city: ['Bangalore', 'Pune'] }, hint: companyLocationIndex },
  { name: 'recommended city results', query: { city: 'Bangalore', sort: 'recommended' }, hint: locationIndex },
  { name: 'text search with city', query: { query: 'engineer', city: 'Bangalore' }, hint: undefined },
  { name: 'text search without equality keys', query: { query: 'engineer' }, hint: undefined },
  { name: 'category without equality keys', query: { jobType: 'Intern' }, hint: dateIndex },
]) {
  test(`numbered ${name} uses a selective index for listings and both exact totals`, async t => {
    const observed = [];
    const run = (kind, options, value) => {
      observed.push(kind);
      assert.deepEqual(options.hint, hint, `${kind} index choice`);
      assert.equal(options.maxTimeMS, 5000);
      return value;
    };
    t.mock.method(Job, 'find', (_filter, _projection, options) => queryChain(async () => run('listings', options, [])));
    t.mock.method(Job, 'aggregate', (_pipeline, options) => queryChain(async () => run('listings', options, [])));
    t.mock.method(Job, 'countDocuments', async (_filter, options) => run('job_total', options, 71));
    t.mock.method(Job, 'distinct', async (_field, _filter, options) => run('company_total', options, ['Acme', 'Beta']));
    t.mock.method(console, 'error', () => {});

    const res = response();
    await getAllJobs({ query, user: { role: 'admin' }, siteSettings: { experiencedJobsEnabled: false } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(observed, ['listings', 'job_total', 'company_total']);
    assert.equal(res.body.pagination.total, 71);
    assert.equal(res.body.pagination.totalCompanies, 2);
  });
}

test('numbered filtered queries tolerate a missing optional index without losing their execution budget', async t => {
  const observed = { listings: [], job_total: [], company_total: [] };
  const run = (kind, options, value) => {
    observed[kind].push(options);
    if (options.hint) throw Object.assign(new Error('hint provided does not correspond to an existing index'), { code: 2 });
    return value;
  };
  t.mock.method(Job, 'find', (_filter, _projection, options) => queryChain(async () => run('listings', options, [])));
  t.mock.method(Job, 'countDocuments', async (_filter, options) => run('job_total', options, 0));
  t.mock.method(Job, 'distinct', async (_field, _filter, options) => run('company_total', options, []));

  const res = response();
  await getAllJobs({ query: { city: 'Bangalore', jobType: 'Intern' }, user: { role: 'admin' } }, res);

  assert.equal(res.statusCode, 200);
  for (const [kind, options] of Object.entries(observed)) {
    assert.deepEqual(options, [
      { maxTimeMS: 5000, hint: locationIndex },
      { maxTimeMS: 5000 },
    ], kind);
  }
});

test('filtered query timeouts are reported without retrying expensive database work', async t => {
  let countCalls = 0;
  t.mock.method(Job, 'find', () => queryChain(async () => []));
  t.mock.method(Job, 'countDocuments', async () => {
    countCalls++;
    throw Object.assign(new Error('execution time limit'), { code: 50 });
  });
  t.mock.method(Job, 'distinct', async () => []);
  t.mock.method(console, 'warn', () => {});

  const res = response();
  await getAllJobs({ query: { city: 'Bangalore' }, user: { role: 'admin' } }, res);

  assert.equal(res.statusCode, 408);
  assert.equal(res.body.code, 'QUERY_TIMEOUT');
  assert.equal(countCalls, 1);
});

test('filtered listings and exact totals still work against Mongo before indexes are provisioned', { timeout: 30000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await Job.collection.insertMany([
    { fingerprint: 'index-fallback-intern', title: 'Engineering Intern', company: 'Acme',
      jobType: 'Intern', location: 'Bangalore, India', locationKeys: ['bangalore'],
      status: 'active', isPublicIndia: true, sourceDescription: 'Build and test reliable software.' },
    { fingerprint: 'index-fallback-contract', title: 'Contract Engineer', company: 'Beta',
      jobType: 'Contract', location: 'Bangalore, India', locationKeys: ['bangalore'],
      status: 'active', isPublicIndia: true, sourceDescription: 'Build and test reliable software.' },
  ]);
  assert.deepEqual((await Job.collection.indexes()).map(index => index.name), ['_id_']);

  const res = response();
  await getAllJobs({ query: { city: 'Bangalore', jobType: 'Intern' }, user: { role: 'admin' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.map(job => job.title), ['Engineering Intern']);
  assert.deepEqual(res.body.pagination, { total: 1, totalCompanies: 1, page: 1, limit: 12, totalPages: 1 });

  for (const sort of ['latest', 'oldest', 'popularity']) {
    const unfiltered = response();
    await getAllJobs({ query: { sort }, user: { role: 'admin' },
      siteSettings: { experiencedJobsEnabled: false } }, unfiltered);
    assert.equal(unfiltered.statusCode, 200, sort);
    assert.equal(unfiltered.body.data.length, 2, sort);
    assert.equal(unfiltered.body.pagination.total, 2, sort);
    assert.equal(unfiltered.body.pagination.totalCompanies, 2, sort);
  }
});
