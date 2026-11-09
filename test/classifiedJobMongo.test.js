import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { resolveClassification } from '../src/services/jobClassificationPolicy.js';
import { classifySavedJobs } from '../scripts/classifySavedJobs.js';
import { resolvePostScrapeClassification, GLICLASS_IDENTITY } from '../src/services/postScrapeClassification.js';
import { saveToDB, generateFingerprint } from '../scraper-support/utils/saveToDB.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';
import { buildJobFilterConditions, jobMatchesSavedFilters } from '../src/services/jobFilterMatcher.js';
import { normalizeJobListResponseJob } from '../src/controllers/jobController.js';

const prediction = (label = 'Full-time Experienced') => ({ fullDescriptionCovered: true, windows: 1, modelLabel: label,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(value => [value, value === label ? .97 : .01])) });
const classifyPending = now => classifySavedJobs({ mode: 'policy', now: () => now,
  worker: { classify: async () => prediction() } });

test('persisted authoritative categories and experience filters agree with Mongo and alerts', { timeout: 300000 }, async t => {
  const mongo = new MongoMemoryServer({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongo.start();
  await mongoose.connect(mongo.getUri());
  const cases = [
    { title: 'Graduate Engineer', description: 'Full-time recruitment for the 2025 batch.' },
    { title: 'Engineering Manager', description: 'Manage engineering teams.' },
    { title: 'Finance Intern', description: 'An internship requiring 1 year of experience.' },
    { title: 'Contract Engineer', description: 'Contract position requiring 3 years of experience.' },
    { title: 'Engineer', description: 'Build software.' },
  ];
  const now = new Date('2026-10-02T12:00:00Z');
  const fixtures = cases.map((job, index) => normalizeScrapedJob({ ...job, company: 'Test Company', fingerprint: `classified-${index}`, status: 'active', classification: resolvePostScrapeClassification(job, prediction(), { mode: 'policy', now }) }));
  await Job.bulkWrite(fixtures.map(job => ({ updateOne: { filter: { fingerprint: job.fingerprint }, update: { $set: job }, upsert: true } })));
  const stored = await Job.find({}).lean().exec();
  assert.equal(stored[0].classification.authoritative, true);
  const actual = await Job.aggregate([{ $project: { fingerprint: 1, category: PUBLIC_JOB_TYPE_EXPRESSION } }]).exec();
  for (const row of actual) {
    const job = stored.find(candidate => candidate.fingerprint === row.fingerprint);
    assert.equal(row.category, normalizeJobListResponseJob(job).jobType);
    assert.equal(row.category, job.jobType);
    if (job.classification.resolved.jobType === 'Unspecified') assert.equal(job.jobType, 'Unspecified');
  }
  for (const experienceYear of ['0', '1', '3', 'unspecified']) {
    const matched = await Job.find(buildJobFilterConditions({ experienceYear })).select('fingerprint').lean().exec();
    const expected = stored.filter(job => jobMatchesSavedFilters({ job, filters: { experienceYear } }));
    assert.deepEqual(matched.map(job => job.fingerprint).sort(), expected.map(job => job.fingerprint).sort(), experienceYear);
  }
  assert.deepEqual((await Job.find(buildJobFilterConditions({ experienceYear: '0' })).lean().exec()).map(job => job.jobType), ['Intern']);
  assert.deepEqual((await Job.find(buildJobFilterConditions({ experienceYear: 'unspecified' })).lean().exec()).map(job => job.jobType), ['Full-time Experienced']);

  await t.test('uncertain source experience excludes stale numeric years in Mongo and saved filters', async () => {
    const unknown = stored.find(job => job.classification.decisionSource === 'model_fallback');
    assert.ok(unknown);
    await Job.updateOne({ _id: unknown._id }, { $set: { experienceYears: [3, 5] } });
    const stale = await Job.findById(unknown._id).lean();
    for (const experienceYear of ['3', '5']) {
      const matches = await Job.find({ $and: [{ _id: unknown._id }, buildJobFilterConditions({ experienceYear })] }).lean();
      assert.equal(matches.length, 0);
      assert.equal(jobMatchesSavedFilters({ job: stale, filters: { experienceYear } }), false);
    }
    assert.equal(jobMatchesSavedFilters({ job: stale, filters: { experienceYear: 'unspecified' } }), true);
    await Job.updateOne({ _id: unknown._id }, { $set: { experienceYears: unknown.experienceYears } });
  });

  await t.test('rescrapes with valid descriptions update all authoritative fields together', async () => {
    const job = { title: 'Senior Engineer', company: 'Recovery Company', location: 'Bangalore, India', city: 'Bangalore', country: 'India', source: 'recovery', applyUrl: 'https://example.com/jobs/recovery', sourceUrl: 'https://example.com/jobs/recovery', sourceEmploymentType: 'Full-time', description: 'A permanent role requiring 5 years of professional experience.' };
    const normalized = normalizeScrapedJob(job);
    const fingerprint = generateFingerprint(normalized);
    const original = resolvePostScrapeClassification(job, prediction(), { now, mode: 'policy' });
    await Job.create({ ...normalized, fingerprint, classification: { ...original, runtimeHash: 'outdated' }, experienceYears: [9], seniority: 'Unknown', source: 'recovery' });
    const options = { now, enrichPublicExperience: false, replaceExisting: false, enqueueAlerts: false, refreshDatasetSummary: false };
    await saveToDB([{ ...job, sourceEmploymentType: null, preserveExistingSourceContent: true }], 'recovery', options);
    assert.equal((await Job.findOne({ fingerprint }).lean()).postClassification.status, 'pending');
    await classifyPending(now);
    const saved = await Job.findOne({ fingerprint }).lean().exec();
    assert.deepEqual(saved.experienceYears, saved.classification.resolved.experienceYears);
    assert.deepEqual(saved.experienceYears, [5]);
    assert.equal(saved.seniority, 'Senior');
    assert.equal(saved.classification.resolved.seniority, saved.seniority);
    assert.equal(saved.description, job.description);

    // An empty partial rescrape retains the verified source for enrichment.
    const skipped = await saveToDB([{ ...job, description: null, preserveExistingSourceContent: true }], 'recovery', options);
    assert.equal(skipped.filteredEmptyDescription, 0);
    assert.equal(skipped.inserted, 0);
    assert.equal(skipped.updated, 1);
    const retained = await Job.findOne({ fingerprint }).lean().exec();
    assert.equal(retained.sourceDescription, saved.sourceDescription);
    assert.equal(retained.sourceContentHash, saved.sourceContentHash);
    assert.equal(retained.description, saved.description);
    assert.deepEqual(retained.experienceYears, saved.experienceYears);
  });

  await t.test('the previous cohort overrides employer zero in Mongo, API responses and filters', async () => {
    const sourceJob = {
      title: 'Associate System Engineer', company: 'American Chase', fingerprint: 'graduate-source-zero', status: 'active',
      employmentType: 'Full Time', sourceEmploymentType: 'Full Time', experienceRequired: '0', sourceExperienceRequired: '0',
      experienceLevel: 'Junior Level', description: 'Batch Required Graduate 2025. Full Time (Night Shift).',
    };
    const job = normalizeScrapedJob({ ...sourceJob, classification: resolveClassification(sourceJob, null, { now, mode: 'policy' }) });
    await Job.create(job);
    const [row] = await Job.aggregate([{ $match: { fingerprint: job.fingerprint } }, { $project: { category: PUBLIC_JOB_TYPE_EXPRESSION } }]);
    assert.equal(row.category, 'Full-time Experienced');
    assert.equal(normalizeJobListResponseJob(job).jobType, row.category);
    const filters = { jobType: 'Full-time Experienced', experienceYear: '1' };
    assert.equal(jobMatchesSavedFilters({ job, filters }), true);
    assert.ok(await Job.findOne({ $and: [{ fingerprint: job.fingerprint }, buildJobFilterConditions(filters)] }).lean().exec());
    assert.equal(job.sourceExperienceRequired, '0');
    assert.equal(job.experienceProfile.hasExplicitExperience, false);
    assert.equal(jobMatchesSavedFilters({ job, filters: { experienceYear: '0' } }), false);
  });

  await t.test('policy intern zero and stale-version legacy fallback have Mongo/JavaScript parity', async () => {
    const internSource = { title: 'Intern - Software Engineering', company: 'Test Company', description: 'Learn engineering skills.', fingerprint: 'policy-intern-zero', status: 'active' };
    const intern = normalizeScrapedJob({ ...internSource, classification: resolveClassification(internSource, null, { now, mode: 'policy' }) });
    const stale = { title: 'Graduate Engineer', company: 'Test Company', description: 'Freshers welcome.', fingerprint: 'stale-policy-fresher', status: 'active', jobType: 'Full-time Fresher', experienceYears: [0], classification: { authoritative: true, mode: 'enforce', policyVersion: 'obsolete-policy-version', status: 'accepted' } };
    await Job.insertMany([intern, stale]);
    for (const job of [intern, stale]) {
      assert.equal(jobMatchesSavedFilters({ job, filters: { experienceYear: '0' } }), true);
      assert.ok(await Job.findOne({ $and: [{ fingerprint: job.fingerprint }, buildJobFilterConditions({ experienceYear: '0' })] }).lean().exec());
    }
  });

  await t.test('numeric employer zero is retained by the real persistence path', async () => {
    const job = { title: 'Graduate Engineer', company: 'Numeric Zero Company', location: 'Bangalore, India', city: 'Bangalore', country: 'India', source: 'numeric-zero', applyUrl: 'https://example.com/jobs/numeric-zero', sourceUrl: 'https://example.com/jobs/numeric-zero', sourceEmploymentType: 'Full Time', sourceExperienceRequired: 0, description: 'Full-time role for 2026 graduates.' };
    await saveToDB([job], 'numeric-zero', { now, enrichPublicExperience: false, replaceExisting: false, enqueueAlerts: false, refreshDatasetSummary: false });
    await classifyPending(now);
    const saved = await Job.findOne({ source: 'numeric-zero' }).lean().exec();
    assert.equal(saved.sourceExperienceRequired, '0');
    assert.deepEqual(saved.experienceYears, [0]);
    assert.equal(saved.experienceBasis, 'graduation_cohort');
    assert.equal(saved.classification.mode, 'policy');
    assert.equal(saved.classification.complete, true);
    assert.ok(saved.classification.windows > 0);
    assert.equal(saved.classification.modelRevision, GLICLASS_IDENTITY.modelRevision);
    assert.equal(saved.postClassification.result.classification.inputHash, saved.classification.inputHash);
  });

  await t.test('employer batch provenance survives persistence and a partial rescrape', async () => {
    const job = { title: 'Graduate Engineer', company: 'Batch Company', location: 'Bangalore, India', city: 'Bangalore', country: 'India', source: 'batch-provenance', applyUrl: 'https://example.com/jobs/batch-provenance', sourceUrl: 'https://example.com/jobs/batch-provenance', sourceEmploymentType: 'Full Time', eligibleBatches: [2025], eligibleBatchesProvenance: 'source', description: 'Graduate engineering recruitment.' };
    const options = { now, enrichPublicExperience: false, replaceExisting: false, enqueueAlerts: false, refreshDatasetSummary: false };
    await saveToDB([job], 'batch-provenance', options);
    await classifyPending(now);
    let saved = await Job.findOne({ source: 'batch-provenance' }).lean().exec();
    assert.equal(saved.eligibleBatchesProvenance, 'source');
    assert.deepEqual(saved.experienceYears, [1]);
    await saveToDB([{ ...job, description: null, eligibleBatches: [], eligibleBatchesProvenance: null, preserveExistingSourceContent: true }], 'batch-provenance', options);
    saved = await Job.findOne({ source: 'batch-provenance' }).lean().exec();
    assert.equal(saved.eligibleBatchesProvenance, 'source');
    assert.deepEqual(saved.experienceYears, [1]);
  });

  await t.test('source-marked ATS fields remain employer facts after classification and rescraping', async () => {
    const job = { title: 'Engineer', company: 'Opt-in Source Company', location: 'Bangalore, India', city: 'Bangalore', country: 'India', source: 'opt-in-source', applyUrl: 'https://example.com/jobs/opt-in-source', sourceUrl: 'https://example.com/jobs/opt-in-source', employmentType: 'Full Time', employmentTypeProvenance: 'source', experienceRequired: '5', experienceRequiredProvenance: 'source', description: 'Develop and test products.' };
    const options = { now, enrichPublicExperience: false, replaceExisting: false, enqueueAlerts: false, refreshDatasetSummary: false };
    await saveToDB([job], 'opt-in-source', options);
    await classifyPending(now);
    let saved = await Job.findOne({ source: 'opt-in-source' }).lean().exec();
    assert.equal(saved.sourceExperienceRequired, '5');
    assert.equal(saved.sourceEmploymentType, 'Full Time');
    await saveToDB([{ ...job, description: null, employmentTypeProvenance: null, experienceRequired: null, experienceRequiredProvenance: null, preserveExistingSourceContent: true }], 'opt-in-source', options);
    saved = await Job.findOne({ source: 'opt-in-source' }).lean().exec();
    assert.equal(saved.jobType, 'Full-time Experienced');
    assert.equal(saved.experienceProfile.minimumYears, 5);
    assert.equal(saved.sourceExperienceRequired, '5');
  });

  await t.test('listing-only rescrapes preserve source categories and the model fallback', async t => {
    const options = { now, enrichPublicExperience: false, replaceExisting: false, enqueueAlerts: false, refreshDatasetSummary: false };
    for (const [source, sourceEmploymentType, expectedType] of [
      ['partial-contract', 'Contract', 'Contract'],
      ['partial-intern', 'Internship', 'Intern'],
      ['partial-unknown', null, 'Full-time Experienced'],
    ]) {
      await t.test(expectedType, async () => {
        const listing = { title: 'Engineer', company: 'Partial Detail Company', source,
          location: 'Bangalore, India', city: 'Bangalore', country: 'India',
          applyUrl: `https://example.com/jobs/${source}`, sourceUrl: `https://example.com/jobs/${source}` };
        await saveToDB([{ ...listing, sourceEmploymentType, minimumQualification: 'A degree in engineering.',
          description: 'Develop reliable product services and collaborate with the engineering team.' }], source, options);
        await classifyPending(now);
        const prior = await Job.findOne({ source }).lean();
        assert.equal(prior.jobType, expectedType);
        await saveToDB([{ ...listing, preserveExistingSourceContent: true }], source, options);
        const retained = await Job.findById(prior._id).lean();
        assert.equal(retained.jobType, expectedType);
        assert.equal(retained.employmentType, prior.employmentType);
        assert.equal(retained.sourceEmploymentType, prior.sourceEmploymentType);
        assert.equal(retained.sourceExperienceRequired, prior.sourceExperienceRequired);
        assert.equal(retained.minimumQualification, prior.minimumQualification);
        assert.equal(retained.sourceDescription, prior.sourceDescription);
        assert.equal(retained.sourceContentHash, prior.sourceContentHash);
        assert.deepEqual(retained.experienceYears, prior.experienceYears);

        // A successful new detail fetch must replace the retained source and
        // queue a decision for the changed facts, even if the fallback flag is stale.
        const updatedDescription = 'Permanent full-time work requiring 5 years of professional experience.';
        await saveToDB([{ ...listing, preserveExistingSourceContent: true,
          sourceEmploymentType: 'Full-time', sourceExperienceRequired: '5', description: updatedDescription }], source, options);
        const changed = await Job.findById(prior._id).lean();
        assert.equal(changed.sourceDescription, updatedDescription);
        assert.notEqual(changed.sourceContentHash, prior.sourceContentHash);
        assert.equal(changed.sourceEmploymentType, 'Full-time');
        assert.equal(changed.sourceExperienceRequired, '5');
        assert.equal(changed.jobType, 'Unspecified');
        assert.equal(changed.classification, undefined);
        assert.equal(changed.postClassification.status, 'pending');
        await classifyPending(now);
        assert.equal((await Job.findById(prior._id).lean()).jobType, 'Full-time Experienced');
      });
    }
  });

  await t.test('fresh detail on a new role clears a stale preservation flag before insertion', async () => {
    const source = 'new-recovered-detail';
    const description = 'Develop reliable product services and collaborate with the engineering team.';
    await saveToDB([{ title: 'Engineer', company: 'Recovered Detail Company', source,
      city: 'Bangalore', country: 'India', location: 'Bangalore, India',
      applyUrl: 'https://example.com/jobs/recovered-detail', preserveExistingSourceContent: true,
      description }], source, { now, enrichPublicExperience: false, replaceExisting: false,
      enqueueAlerts: false, refreshDatasetSummary: false });
    const stored = await Job.findOne({ source }).lean();
    assert.equal(stored.sourceDescription, description);
    assert.equal(stored.postClassification.status, 'pending');
  });

  await t.test('a classifier outage leaves saved jobs queued for a later retry', async () => {
    const source = 'native-outage';
    await saveToDB([{ title: 'Engineering Intern', company: 'Outage Company', source,
      location: 'Bangalore, India', country: 'India', description: 'Internship for current students.', applyUrl: 'https://example.com/jobs/native-outage' }], source,
      { now, enrichPublicExperience: false, replaceExisting: false, enqueueAlerts: false, refreshDatasetSummary: false });
    let saved = await Job.findOne({ source }).lean();
    assert.equal(saved.postClassification.status, 'pending');
    assert.equal(saved.classification, undefined);
    const result = await classifySavedJobs({ mode: 'policy', now: () => now,
      worker: { classify: async () => { throw new Error('offline'); } } });
    assert.ok(result.failed > 0);
    saved = await Job.findOne({ source }).lean();
    assert.equal(saved.postClassification.status, 'failed');
    assert.equal(saved.classification, undefined);
    await classifyPending(now);
    saved = await Job.findOne({ source }).lean();
    assert.equal(saved.postClassification.status, 'completed');
    assert.equal(saved.jobType, 'Intern');
  });
});
