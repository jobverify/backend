import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { collectPublicationDiagnostics, readPublicationDiagnostics } from '../scripts/diagnosePublicationGaps.js';
import { buildPublicationDiagnosticPipeline, MAX_PUBLICATION_DIAGNOSTIC_JOBS, summarizePublicationDiagnostics } from '../src/utils/jobPublicationDiagnostics.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';

const now = new Date('2026-10-29T14:00:00.000Z');

test('diagnostics validate source selection and reference clock before any database call', () => {
  for (const sources of [undefined, [], ['$where'], [{ $ne: null }], Array(101).fill('a')]) {
    assert.throws(() => buildPublicationDiagnosticPipeline({ sources, now }), /source IDs/);
  }
  assert.throws(() => buildPublicationDiagnosticPipeline({ sources: ['a'], now: new Date(NaN) }), /reference date/);
});

test('publication diagnosis explains actual Mongo visibility without publishing missing employer content', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
  const database = mongoose.connection.db;
  await database.collection('sitesettings').insertOne({ _id: 'global', experiencedJobsEnabled: false });
  const base = { source: 'target', status: 'active', country: 'India', isPublicIndia: true,
    company: 'Employer', title: 'Engineering Intern', jobType: 'Intern', sourceDescription: 'Build APIs.' };
  const cases = [
    { key: 'visible', changes: {}, reasons: [] },
    { key: 'missing', changes: { sourceDescription: '', description: 'Generated summary cannot replace employer content.' }, reasons: ['missing_source_description'] },
    { key: 'blank-html', changes: { sourceDescription: '<p>&nbsp;</p>' }, reasons: ['missing_source_description'] },
    { key: 'foreign', changes: { isPublicIndia: false }, reasons: ['outside_india_scope'] },
    { key: 'expired', changes: { status: 'expired' }, reasons: ['inactive'] },
    { key: 'closed', changes: { closingDate: new Date('2026-10-28T00:00:00Z') }, reasons: ['outside_publication_window_or_closed'] },
    { key: 'old', changes: { postedAt: new Date('2026-09-01T00:00:00Z') }, reasons: ['outside_publication_window_or_closed'] },
    { key: 'future', changes: { postedAt: new Date('2026-11-01T00:00:00Z') }, reasons: ['outside_publication_window_or_closed'] },
    { key: 'experienced', changes: { title: 'Senior Engineer', jobType: 'Full-time Experienced', sourceDescription: '5 years of engineering experience required.' }, reasons: ['experienced_jobs_disabled'] },
    { key: 'unclassified', changes: { jobType: 'Unspecified' }, reasons: ['unclassified_job_type'] },
    { key: 'aggregate', changes: { title: 'Current openings at Employer', jobId: 'employer-current-openings' }, reasons: ['aggregate_hiring_signal'] },
    { key: 'multiple', changes: { status: 'expired', isPublicIndia: false, sourceDescription: '' }, reasons: ['inactive', 'outside_india_scope', 'missing_source_description'] },
    { key: 'legacy', changes: { sourceDescription: undefined, description: 'Employer authored description.' }, reasons: [] },
  ];
  await database.collection('jobs').insertMany(cases.map(({ key, changes }) => {
    const job = { ...base, jobId: key, ...changes };
    if (Object.hasOwn(changes, 'sourceDescription') && changes.sourceDescription === undefined) delete job.sourceDescription;
    return job;
  }));
  await database.collection('jobs').insertOne({ ...base, source: 'unselected' });
  const report = await collectPublicationDiagnostics({ database, sources: ['target', 'absent'], now });
  assert.equal(report.databaseAvailable, true);
  assert.equal(report.readOnly, true);
  assert.equal(report.countsComplete, true);
  assert.equal(report.jobs.length, cases.length);
  for (const row of report.jobs) {
    const fixture = cases.find(value => (value.changes.jobId || value.key) === row.jobId);
    assert.deepEqual(row.blockingReasons, fixture.reasons, fixture.key);
    assert.equal(row.visible, fixture.reasons.length === 0, fixture.key);
    assert.equal(Object.hasOwn(row, 'sourceDescription'), false);
    assert.equal(Object.hasOwn(row, 'description'), false);
  }
  const publicIds = await database.collection('jobs').find(applyPublicJobVisibility({ source: 'target', status: 'active' },
    { experiencedJobsEnabled: false }, now)).map(row => String(row._id)).toArray();
  assert.deepEqual(report.jobs.filter(row => row.visible).map(row => row._id), publicIds);
  assert.deepEqual(report.sources.find(row => row.source === 'absent'), {
    source: 'absent', savedJobs: 0, visibleJobs: 0, observedJobs: 0, blockingReasonCounts: {},
  });
  assert.equal(await database.collection('jobs').countDocuments(), cases.length + 1);
  const unclassified = report.jobs.find(row => row.jobId === 'unclassified');
  assert.equal(unclassified.jobType, 'Unspecified');
  assert.equal(unclassified.publicJobType, 'Unspecified');
});

test('failed connections and reads preserve unknown counts and redact driver details', async () => {
  const database = { collection() { return { async findOne() { throw new Error('mongodb://user:secret@private.example'); } }; } };
  const failed = await collectPublicationDiagnostics({ database, sources: ['target'], now });
  assert.equal(failed.databaseAvailable, false);
  assert.equal(failed.sources, null);
  assert.doesNotMatch(JSON.stringify(failed), /secret|private.example/);
  let disconnected = false;
  const connector = { connection: {}, async connect(uri, options) {
    assert.equal(uri, 'test-uri');
    assert.equal(options.autoIndex, false);
    assert.equal(options.autoCreate, false);
    throw new Error('mongodb://user:secret@private.example');
  }, async disconnect() { disconnected = true; } };
  assert.equal((await readPublicationDiagnostics({ sources: ['target'], now, connector, uri: 'test-uri' })).databaseAvailable, false);
  assert.equal(disconnected, true);
});

test('truncated diagnostics cannot report complete source inventories', () => {
  const jobs = Array.from({ length: MAX_PUBLICATION_DIAGNOSTIC_JOBS + 1 }, (_, index) => ({ _id: index, source: 'target' }));
  const report = summarizePublicationDiagnostics({ jobs, visible: [] }, { sources: ['target'], now });
  assert.equal(report.countsComplete, false);
  assert.equal(report.sources[0].savedJobs, null);
  assert.equal(report.sources[0].visibleJobs, null);
  assert.equal(report.jobs.length, MAX_PUBLICATION_DIAGNOSTIC_JOBS);
  assert.deepEqual(report.jobs[0].blockingReasons, ['unclassified_visibility_rule']);
});
