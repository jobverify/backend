import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import SiteSettings from '../src/models/SiteSettings.js';
process.env.JWT_SECRET ||= 'related-jobs-tests-only-secret';
const { default: jobRoutes } = await import('../src/routes/jobRoutes.js');
import { getPublishingBuildFeed } from '../src/controllers/publishingController.js';

const seedId = '665f47f5f65f3f4d2e1d1001';
const response = () => ({ statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; },
  status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } });

test('related public jobs and publishing dates use the real public inventory', { timeout: 180000 }, async t => {
  const mongo = new MongoMemoryServer({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongo.start();
  await mongoose.connect(mongo.getUri());
  const now = new Date();
  const postedAt = new Date(now.getTime() - 86400000);
  const record = (suffix, patch = {}) => ({
    _id: new mongoose.Types.ObjectId('665f47f5f65f3f4d2e1d' + suffix),
    title: 'Frontend Engineer ' + suffix, company: 'Example', companyKey: 'example',
    source: 'related-fixture', fingerprint: 'related-' + suffix,
    sourceUrl: 'https://careers.example.test/' + suffix, applyUrl: 'https://careers.example.test/apply/' + suffix,
    description: 'Build accessible customer interfaces, test software and work with the engineering team. Maintain reliable products and document technical decisions.',
    sourceDescription: 'Build accessible customer interfaces, test software and work with the engineering team. Maintain reliable products and document technical decisions.',
    sourceContentHash: 'private-source-hash',
    city: 'Bangalore', location: 'Bangalore, India', country: 'India', isPublicIndia: true,
    status: 'active', jobType: 'Full-time Fresher', experienceRequired: 'No experience required', experienceLevel: 'Entry Level',
    primaryRoleDomain: 'Software Engineering', skillIds: ['javascript'],
    employerPostedAt: postedAt, postedAt, sortDate: postedAt, closingDate: new Date(now.getTime() + 86400000 * 10),
    postedAtProvenance: 'source', postedAtProvenanceValue: postedAt.toISOString(), ...patch,
  });
  await Job.collection.insertMany([
    record('1001'), record('1002'), record('1003'), record('1004'), record('1005'),
    record('1006', { jobType: 'Full-time Experienced', experienceRequired: '5 years', sortDate: now }),
    record('2001', { company: 'Other', companyKey: 'other' }),
    record('2002', { company: 'Another', companyKey: 'another', city: 'Chennai' }),
    record('2003', { company: 'Senior roles', companyKey: 'senior roles', jobType: 'Full-time Experienced', experienceRequired: '5 years' }),
    record('3001', { closingDate: new Date(now.getTime() - 1) }),
    record('3002', { status: 'hidden' }), record('3003', { isPublicIndia: false }),
    record('3004', { jobType: 'Unspecified' }), record('3005', { description: '', sourceDescription: '' }),
    record('3006', { workdayApplicationStatus: 'unavailable' }),
    record('4001', { company: 'Unrelated', companyKey: 'unrelated', primaryRoleDomain: 'Other', skillIds: [] }),
  ]);
  const app = express();
  app.use('/api/jobs', jobRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = 'http://127.0.0.1:' + server.address().port;

  await t.test('public related endpoint returns bounded relevant jobs without private source data', async () => {
    const result = await fetch(url + '/api/jobs/' + seedId + '/related');
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.data.jobId, seedId);
    assert.equal(body.data.sameCompany.length, 3);
    assert.equal(body.data.similar.length, 2);
    const rows = [...body.data.sameCompany, ...body.data.similar];
    assert.equal(new Set(rows.map(row => row._id)).size, rows.length);
    for (const row of rows) {
      assert.notEqual(row._id, seedId);
      assert.equal(row.applicationStatus, 'available');
      assert.equal(Object.hasOwn(row, 'sourceDescription'), false);
      assert.equal(Object.hasOwn(row, 'sourceContentHash'), false);
      assert.equal(Object.hasOwn(row, 'description'), false);
      assert.ok(!['3001', '3002', '3003', '3004', '3005', '3006', '4001'].some(suffix => row._id.endsWith(suffix)));
    }
    assert.ok(body.data.similar.every(row => row.jobType === 'Full-time Fresher'));
  });

  await t.test('experienced visibility applies to recommendations and seed lookup', async () => {
    await SiteSettings.updateOne({ _id: 'global' }, { $set: { experiencedJobsEnabled: false } }, { upsert: true });
    try {
    const result = await fetch(url + '/api/jobs/' + seedId + '/related');
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.ok([...body.data.sameCompany, ...body.data.similar].every(row => row.jobType !== 'Full-time Experienced'));
    assert.equal((await fetch(url + '/api/jobs/665f47f5f65f3f4d2e1d1006/related')).status, 404);
    } finally { await SiteSettings.updateOne({ _id: 'global' }, { $set: { experiencedJobsEnabled: true } }); }
  });

  await t.test('compact recommendations preserve source and profile derived public categories', async () => {
    const categoryFields = { experienceRequired: '', experienceLevel: '', primaryRoleDomain: 'Projection Regression', skillIds: ['projection-check'] };
    const sourceFields = { ...categoryFields, jobType: 'Full-time', sourceDescription: 'Freshers can apply. Build accessible customer interfaces, test software and work with the engineering team.' };
    const fixtures = [
      record('5001', { ...sourceFields, company: 'Projection', companyKey: 'projection' }),
      record('5002', { ...categoryFields, company: 'Projection', companyKey: 'projection', jobType: 'Full-time Experienced', experienceProfile: { minimumYears: 0, maximumYears: 1 } }),
      record('5003', { ...sourceFields, company: 'Projection Other', companyKey: 'projection other' }),
    ];
    await Job.collection.insertMany(fixtures);
    await SiteSettings.updateOne({ _id: 'global' }, { $set: { experiencedJobsEnabled: false } }, { upsert: true });
    try {
      for (const suffix of ['5001', '5002']) {
        const result = await fetch(url + '/api/jobs/665f47f5f65f3f4d2e1d' + suffix + '/related');
        assert.equal(result.status, 200);
        const { data } = await result.json();
        assert.equal(data.sameCompany.length, 1);
        assert.equal(data.similar.length, 1, 'similarity must use the effective seed category');
        for (const card of [...data.sameCompany, ...data.similar]) {
          assert.equal(card.jobType, 'Full-time Fresher', 'compact cards must retain the public query category');
          assert.equal(Object.hasOwn(card, 'sourceDescription'), false);
          assert.equal(Object.hasOwn(card, '_publicJobType'), false);
        }
      }
    } finally {
      await SiteSettings.updateOne({ _id: 'global' }, { $set: { experiencedJobsEnabled: true } });
      await Job.deleteMany({ _id: { $in: fixtures.map(job => job._id) } });
    }
  });

  await t.test('invalid, hidden, expired, missing and unavailable seeds do not produce recommendations', async () => {
    assert.equal((await fetch(url + '/api/jobs/not-an-id/related')).status, 400);
    for (const suffix of ['3001', '3002', '3003', '3004', '3005', '3006', '9999']) {
      assert.equal((await fetch(url + '/api/jobs/665f47f5f65f3f4d2e1d' + suffix + '/related')).status, 404, suffix);
    }
  });

  await t.test('build feed preserves source posting date provenance for initial HTML', async () => {
    const res = response();
    await getPublishingBuildFeed({ query: {} }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    const job = res.body.data.jobs.find(row => String(row._id) === seedId);
    assert.ok(job, 'the source-backed seed must be in the public build feed');
    assert.equal(new Date(job.employerPostedAt).toISOString(), postedAt.toISOString());
    assert.equal(job.postedAtProvenance, 'source');
    assert.equal(job.postedAtProvenanceValue, postedAt.toISOString());
  });
});
