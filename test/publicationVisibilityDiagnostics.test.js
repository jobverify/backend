import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { collectPublishingGapSnapshot } from '../scripts/collectPublishingGapSnapshot.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';

const now = new Date('2026-11-07T03:40:00.000Z');
const cutoff = new Date('2026-10-07T00:00:00.000Z');
const base = {
  source: 'saved-hidden', title: 'Software Engineer', jobType: 'Contract',
  company: 'Example', status: 'active', isPublicIndia: true,
  description: 'Build and maintain the employer software product.',
  postedAt: new Date('2026-11-05T00:00:00Z'),
};

test('read-only visibility diagnostics explain overlapping exclusions using the actual public query', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)), version: '8.2.6',
  } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
  const database = mongoose.connection.db;
  await database.collection('sitesettings').insertOne({ _id: 'global', experiencedJobsEnabled: false });
  const fixtures = [
    { jobId: 'visible' },
    { jobId: 'inactive', status: 'expired' },
    { jobId: 'closed', closingDate: now },
    { jobId: 'old', postedAt: new Date(cutoff.getTime() - 1) },
    { jobId: 'future', postedAt: new Date(now.getTime() + 1) },
    { jobId: 'not-india', isPublicIndia: false, country: 'India', city: 'Bangalore' },
    { jobId: 'missing-india-flag', isPublicIndia: undefined },
    { jobId: 'example-current-openings', title: 'Current openings at Example' },
    { jobId: 'empty-source', sourceDescription: '<p>&nbsp;</p>', description: 'Display copy cannot replace empty employer content.' },
    { jobId: 'other-category', jobType: 'Others' },
    { jobId: 'experienced', jobType: 'Full-time Experienced', employmentType: 'Full-time', experienceLevel: 'Senior Level' },
    { jobId: 'promoted-fresher', jobType: 'Full-time Fresher', experienceRequired: '5 years' },
    { jobId: 'unknown-category', jobType: undefined },
    { jobId: 'overlap', status: 'expired', isPublicIndia: false, sourceDescription: '', postedAt: new Date(cutoff.getTime() - 1), jobType: 'Others' },
    { jobId: 'missing-posted-at', postedAt: undefined },
    { jobId: 'null-posted-at', postedAt: null },
    { jobId: 'at-cutoff', postedAt: cutoff },
    { jobId: 'at-now', postedAt: now },
    { jobId: 'ordinary-title', title: 'Current openings at Example' },
    { jobId: 'other-source', source: 'unrequested', company: 'Unrequested company' },
  ].map(row => Object.fromEntries(Object.entries({ ...base, ...row }).filter(([, value]) => value !== undefined)));
  await database.collection('jobs').insertMany(fixtures);
  await database.collection('scraperstatuses').insertMany([
    { source: 'saved-hidden', isActive: true }, { source: 'unrequested', isActive: true }, { source: '__pipeline__' },
  ]);
  const before = await database.collection('jobs').find().toArray();
  const reads = [];
  const recordingDatabase = { collection(name) {
    const collection = database.collection(name);
    return Object.fromEntries(['findOne', 'find', 'aggregate'].map(operation => [operation, (...args) => {
      reads.push({ name, operation, query: args[0] });
      return collection[operation](...args);
    }]));
  } };
  const requested = ['saved-hidden', 'zz-no-saved-jobs'];
  const snapshot = await collectPublishingGapSnapshot({ database: recordingDatabase, now, diagnosticSources: requested });
  assert.equal(snapshot.databaseAvailable, true);
  assert.deepEqual(snapshot.statuses.map(row => row.source), ['saved-hidden']);
  assert.ok(snapshot.inventory.every(row => requested.includes(row.source)));
  assert.deepEqual(snapshot.publicCompanyNames, ['Example']);
  const statusRead = reads.find(read => read.name === 'scraperstatuses');
  assert.deepEqual(statusRead.query.source, { $ne: '__pipeline__', $in: requested });
  const jobReads = reads.filter(read => read.name === 'jobs');
  assert.equal(jobReads.length, 3);
  assert.ok(jobReads.every(read => read.operation === 'aggregate'));
  for (const read of jobReads) assert.deepEqual(read.query[0].$match.source, { $in: requested },
    'all optional snapshot job reads must restrict source before aggregating');
  assert.ok(snapshot.publicationDiagnostics, 'requested diagnostics must be present');
  const diagnostics = snapshot.publicationDiagnostics;
  assert.equal(diagnostics.schemaVersion, 1);
  assert.equal(diagnostics.generatedAt, now.toISOString());
  assert.equal(diagnostics.reasonsOverlap, true);
  assert.equal(diagnostics.sources.length, 2, 'diagnostic query must stay scoped to requested sources');
  const row = diagnostics.sources[0];
  assert.equal(row.source, 'saved-hidden');
  assert.equal(row.savedJobs, 19);
  assert.equal(row.visibleJobs, 6);
  assert.equal(row.excludedJobs, 13);
  assert.equal(row.unexplainedExcludedJobs, 0);
  assert.equal(row.complete, true);
  const absent = diagnostics.sources.find(entry => entry.source === 'zz-no-saved-jobs');
  assert.equal(absent.savedJobs, 0);
  assert.equal(absent.visibleJobs, 0);
  assert.equal(absent.complete, true, 'a successful scoped read can prove that a source has no stored jobs');
  assert.deepEqual(row.reasonCounts, {
    'status-not-active': 2,
    'not-marked-public-india': 3,
    'aggregate-hiring-signal': 1,
    'source-description-missing': 2,
    'closing-date-not-open': 1,
    'posted-at-in-future': 1,
    'posted-at-before-public-window': 2,
    'public-category-not-enabled': 5,
  });
  assert.ok(Object.values(row.reasonCounts).reduce((sum, count) => sum + count, 0) > row.excludedJobs);
  const disabled = row.reasonSamples['public-category-not-enabled'];
  assert.ok(disabled.some(job => job.jobId === 'promoted-fresher' && job.publicJobType === 'Full-time Experienced'));
  assert.ok(Object.values(row.reasonSamples).every(samples => samples.length <= 3));
  const visible = await database.collection('jobs').countDocuments(applyPublicJobVisibility({
    source: 'saved-hidden', status: 'active', $or: [{ closingDate: null }, { closingDate: { $gt: now } }],
  }, snapshot.siteSettings, now));
  assert.equal(visible, row.visibleJobs);
  assert.deepEqual(await database.collection('jobs').find().toArray(), before, 'diagnostics must not update stored jobs');
});

test('diagnostic collection distinguishes absent sources from missing diagnostics and rejects invalid source scopes', async () => {
  const snapshot = await collectPublishingGapSnapshot({ database: null, now, diagnosticSources: ['missing'] });
  assert.equal(snapshot.databaseAvailable, false);
  assert.equal(snapshot.inventory, null);
  assert.equal(snapshot.publicationDiagnostics, null);
  await assert.rejects(collectPublishingGapSnapshot({ database: null, now, diagnosticSources: [] }), /non-empty/);
  await assert.rejects(collectPublishingGapSnapshot({ database: null, now, diagnosticSources: [null] }), /source/);
});
