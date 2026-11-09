import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';
import { normalizeJobListResponseJob } from '../src/controllers/jobController.js';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import SiteSettings from '../src/models/SiteSettings.js';
import { getSiteSettings } from '../src/services/siteSettingsService.js';
import { updateSiteSettings } from '../src/controllers/siteSettingsController.js';
import { getSavedJobs } from '../src/controllers/userController.js';
import { loadSiteSettings } from '../src/middleware/siteSettings.js';
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js';

process.env.JWT_SECRET = 'visibility-tests-only-secret-at-least-32-characters';

test('response normalization promotes positive-experience fresher and intern labels', () => {
  assert.equal(
    normalizeJobListResponseJob({
      title: 'Associate Researcher',
      jobType: 'Full-time Fresher',
      experienceRequired: '1 year',
    }).jobType,
    'Full-time Experienced',
  );
  assert.equal(
    normalizeJobListResponseJob({
      title: 'Finance Intern',
      jobType: 'Internship',
      employmentType: 'Internship',
      experienceRequired: '1 year',
    }).jobType,
    'Full-time Experienced',
  );
});

test('response normalization keeps zero-minimum experience ranges as fresher jobs', () => {
  assert.equal(
    normalizeJobListResponseJob({
      title: 'Graduate Software Engineer',
      jobType: 'Full-time Fresher',
      employmentType: 'Full-time',
      experienceRequired: '0-1 years',
    }).jobType,
    'Full-time Fresher',
  );
});

test('experienced job visibility is reversible and consistent across public surfaces', { timeout: 120000 }, async (t) => {
  const mongo = await MongoMemoryServer.create({ binary: {
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
    version: '8.2.6',
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const { default: jobRoutes } = await import('../src/routes/jobRoutes.js');
  await t.test('explicit zero ranges and compact year units have literal public categories', async () => {
    const cases = [
      { title: 'Engineer', jobType: 'Full-time Experienced', experienceRequired: '0-1years', expected: 'Full-time Fresher' },
      { title: 'Engineer', jobType: 'Full-time Experienced', experienceRequired: '0-2 years', expected: 'Full-time Fresher' },
      { title: 'Intern', experienceRequired: '2yrs', expected: 'Full-time Experienced' },
      { title: 'Intern', jobType: 'Intern', experienceRequired: 'Freshers, 5 years', expected: 'Intern' },
      { title: 'Engineer', jobType: 'Full-time Fresher', employmentType: 'Hybrid', expected: 'Full-time Fresher' },
    ];
    const collection = mongoose.connection.collection('literal_category_cases');
    await collection.insertMany(cases);
    const actual = await collection.aggregate([{ $project: { category: PUBLIC_JOB_TYPE_EXPRESSION } }]).toArray();
    assert.deepEqual(actual.map(row => row.category), ['Full-time Fresher', 'Full-time Fresher', 'Full-time Experienced', 'Intern', 'Full-time Fresher']);
    for (const job of cases) assert.equal(normalizeJobListResponseJob(job).jobType, job.expected);
  });
  await t.test('Mongo category decisions match response normalization for legacy and experience variants', async () => {
    const types = ['Full-time Experienced', 'Full-time Fresher', 'Full-time', 'Intern', 'Internship', 'Contract', 'Others', 'part-time', '', 'Permanent'];
    const variants = [
      {}, { experienceLevel: 'Entry Level' }, { experienceLevel: 'Entry  Level' }, { experienceLevel: 'Entry\nLevel' }, { experienceLevel: 'Junior Level' },
      ...['0-1 years', '0-2 years', '0-5 years', '5 years', '2 yrs', '1.5 years', '1.5+ years', '1.5-2 years', '5-2 years', '2 years and above', 'minimum 2 years', 'Freshers, 5 years', '0 years', '1.5\u00a0years', '1.5\u2013 2 years'].map(experienceRequired => ({ experienceRequired })),
      ...[null, 0, 1, 1.5, 2, 5, 41].map(minimumYears => ({ experienceProfile: { minimumYears, maximumYears: 5 } })),
      { experienceProfile: { maximumYears: 2 } },
      ...['Contract', 'Internship', 'Others', 'part-time', 'permanent', 'permanent_staff', 'fixed_term_contract'].map(employmentType => ({ employmentType })),
      ...['Entry Level', 'Junior Level', 'Mid Level', 'Senior Level'].flatMap(experienceLevel => [null, 0, 1, 1.5, 2, 5].flatMap(minimumYears => [null, 1, 5].map(maximumYears => ({ employmentType: 'Full-time', experienceLevel, experienceRequired: '5 years', experienceProfile: { minimumYears, maximumYears } })))),
      { description: 'Recent graduates welcome' }, { department: 'Campus hiring' },
    ];
    const fixtures = types.flatMap(jobType => ['Engineer', 'Graduate Engineer', 'Senior Engineer', 'Intern', 'Junior Engineer'].flatMap(title => variants.map(variant => ({ jobType, title, ...variant }))));
    const collection = mongoose.connection.collection('category_parity');
    await collection.insertMany(fixtures);
    const actual = await collection.aggregate([{ $project: { category: PUBLIC_JOB_TYPE_EXPRESSION } }]).toArray();
    const expected = new Map(fixtures.map(job => [String(job._id), normalizeJobListResponseJob(job).jobType]));
    const mismatches = actual.filter(row => row.category !== expected.get(String(row._id))).map(row => ({ job: fixtures.find(job => String(job._id) === String(row._id)), expected: expected.get(String(row._id)), actual: row.category }));
    assert.deepEqual(mismatches, []);
  });

  const categories = ['Full-time Experienced', 'Full-time Fresher', 'Internship', 'Contract', 'Others', 'Full-time'];
  const ids = categories.map(() => new mongoose.Types.ObjectId());
  await Job.collection.insertMany(categories.map((jobType, index) => ({
    fingerprint: String(ids[index]), _id: ids[index], title: `Opportunity ${index}`, company: `Company ${index}`, companyKey: `company ${index}`,
    jobType, status: 'active', isPublicIndia: true, city: 'Bangalore', country: 'India',
    description: 'Deliver software features and support the engineering team. Review requirements, investigate defects, write automated checks and collaborate with colleagues to maintain reliable applications.',
    sourceUrl: `https://example.com/jobs/${index}`, applyUrl: `https://example.com/jobs/${index}`,
    postedAt: new Date(), sortDate: new Date(),
  })));
  const userId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: userId, email: 'visibility@example.com', savedJobs: ids });
  await refreshJobDatasetSummary(); // Seed an all-category summary to catch stale totals.
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', jobRoutes);
  app.put('/settings', (req, _res, next) => { req.user = { _id: userId }; next(); }, updateSiteSettings);
  app.get('/saved', loadSiteSettings, (req, _res, next) => { req.user = { _id: userId }; next(); }, getSavedJobs);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const read = async (path) => {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    return response.json();
  };

  await t.test('old settings preserve existing visibility and partial updates preserve billing', async () => {
    assert.equal((await getSiteSettings()).experiencedJobsEnabled, true);
    await SiteSettings.create({ _id: 'global', billingEnabled: true });
    const response = await fetch(base + '/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ experiencedJobsEnabled: false }) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { billingEnabled: true, experiencedJobsEnabled: false });
  });
  // Keep downstream tests independent of the settings-update assertion.
  await SiteSettings.collection.updateOne({ _id: 'global' }, { $set: { billingEnabled: false, experiencedJobsEnabled: false } }, { upsert: true });

  await t.test('list pagination and stats exclude the category and its legacy alias', async () => {
    const result = await read('/api/jobs?limit=2');
    assert.equal(result.data.length, 2);
    assert.equal(result.pagination.total, 3);
    assert.equal(result.pagination.totalCompanies, 3);
    assert.deepEqual((await read('/api/jobs/stats')).data, { totalJobs: 3, totalCompanies: 3 });
    assert.equal((await read('/api/jobs?jobType=Full-time%20Experienced')).pagination.total, 0);
  });
  await t.test('search, metadata, company suggestions and live companies use the same scope', async () => {
    assert.equal((await read('/api/jobs/search')).data.length, 3);
    const meta = (await read('/api/jobs/meta')).data;
    assert.ok(!meta.jobTypes.includes('Full-time Experienced'));
    assert.equal((await read('/api/jobs/meta/companies')).data.companies.length, 3);
    assert.equal((await read('/api/jobs/live-companies')).data.companies.length, 3);
    assert.ok(!(await read('/api/jobs/meta?city=Bangalore')).data.jobTypes.includes('Full-time Experienced'));
  });
  await t.test('direct links and SEO feed exclude experienced jobs', async () => {
    assert.equal((await fetch(base + `/api/jobs/${ids[0]}`)).status, 404);
    assert.equal((await fetch(base + `/api/jobs/${ids[1]}`)).status, 200);
    assert.equal((await read('/api/jobs/seo-feed')).data.length, 3);
  });
  await t.test('analytics distributions and totals are calculated from visible jobs', async () => {
    const summary = (await read('/api/jobs/snapshot')).data;
    assert.equal(summary.totalJobs, 3);
    assert.equal(summary.totalCompanies, 3);
    assert.equal(summary.locations[0].count, 3);
    assert.equal(summary.jobTypes.reduce((sum, row) => sum + row.count, 0), 3);
    assert.ok(!summary.jobTypes.some(row => row.label === 'Full-time Experienced'));
  });
  await t.test('saved jobs are hidden without deleting bookmarks', async () => {
    const result = await read('/saved');
    assert.equal(result.data.length, 3);
    assert.equal(result.profileOverview.savedJobs, 3);
    assert.equal((await User.findById(userId)).savedJobs.length, 6);
  });
  await t.test('visibility follows public categories when legacy stored labels disagree', async () => {
    const variants = [
      { jobType: 'Full-time Fresher', experienceRequired: '5 years', title: 'Software Engineer' },
      { jobType: 'Full-time', experienceLevel: 'Entry Level', title: 'Graduate Engineer' },
      { jobType: 'Full-time Experienced', employmentType: 'Contract', title: 'Engineer' },
    ];
    const variantIds = variants.map(() => new mongoose.Types.ObjectId());
    await Job.collection.insertMany(variants.map((variant, index) => ({
      ...variant, fingerprint: String(variantIds[index]), _id: variantIds[index], company: 'Legacy ' + index, companyKey: 'legacy ' + index,
      status: 'active', isPublicIndia: true, city: 'Bangalore', sourceUrl: 'https://example.com/legacy/' + index, description: 'Deliver software features and support the engineering team.',
      postedAt: new Date(), sortDate: new Date(),
    })));
    try {
      const result = await read('/api/jobs');
      assert.equal(result.pagination.total, 5);
      assert.ok(!result.data.some(job => job.jobType === 'Full-time Experienced'));
      assert.equal(result.data.find(job => job._id === String(variantIds[1]))?.jobType, 'Full-time Fresher');
      assert.equal(result.data.find(job => job._id === String(variantIds[2]))?.jobType, 'Contract');
      assert.equal((await fetch(base + '/api/jobs/' + variantIds[0])).status, 404);
      assert.equal((await read('/api/jobs?jobType=Contract')).pagination.total, 2);
      assert.equal((await read('/api/jobs?jobType=Full-time%20Fresher')).pagination.total, 2);
      assert.ok((await read('/api/jobs/meta?jobType=Contract')).data.companies.includes('Legacy 2'));
      assert.equal((await read('/api/jobs/stats')).data.totalJobs, 5);
      assert.equal((await read('/api/jobs/snapshot')).data.totalJobs, 5);
      assert.ok(!(await read('/api/jobs/meta')).data.jobTypes.includes('Full-time Experienced'));
    } finally { await Job.deleteMany({ _id: { $in: variantIds } }); }
  });
  await t.test('reenabling restores jobs, counts, links and bookmarks', async () => {
    await SiteSettings.collection.updateOne({ _id: 'global' }, { $set: { experiencedJobsEnabled: true } });
    assert.equal((await read('/api/jobs')).pagination.total, 4);
    assert.equal((await read('/api/jobs/stats')).data.totalJobs, 4);
    assert.equal((await read('/saved')).data.length, 4);
    assert.equal((await fetch(base + `/api/jobs/${ids[0]}`)).status, 200);
    assert.equal(await Job.countDocuments({}), 6);
  });
});
