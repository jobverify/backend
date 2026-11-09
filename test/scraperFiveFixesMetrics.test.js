import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeScraperRun } from '../scraper-support/utils/scraperRunSummary.js';
import { buildScraperAttemptDiagnostics } from '../scraper-support/runner.js';
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js';
import { describeStageCompletion } from '../src/pipeline/policy.js';
import mongoose from 'mongoose';
import ScraperRun from '../src/models/ScraperRun.js';
import ScraperStatus from '../src/models/ScraperStatus.js';
import { upsertScraperStatus, writeScraperRun } from '../scraper-support/utils/scraperPersistence.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
import { resolveApplicationIdentities } from '../scraper-support/utils/applicationIdentity.js';

const job = (id, extra = {}) => ({ company: 'AECOM', title: 'Engineer', jobId: id,
  country: 'India', location: 'Bangalore, India', city: 'Bangalore',
  applyUrl: `https://aecom.jobs/jobs/${id}`, ...extra });
const diagnose = jobs => buildScraperAttemptDiagnostics(jobs, analyzePublishableJobs(jobs));

test('yield reconciles observations across aliases using the actual persistence identity', () => {
  const first = diagnose([job('1'), job('2')]);
  const alias = diagnose([job('1')]);
  const result = summarizeScraperRun([{ success: true, ...first }, { success: true, ...alias }]);
  assert.deepEqual(result.jobYield, { observations: 3, uniqueJobs: 2, duplicateObservations: 1,
    sourcesWithoutIdentityEvidence: 0 });
});

test('generic application pages retain distinct native vacancies', () => {
  const rows = [job('1', { applyUrl: 'https://company.example/careers', applicationUrlIsGeneric: true }),
    job('2', { applyUrl: 'https://company.example/careers', applicationUrlIsGeneric: true })];
  const summary = summarizeScraperRun([{ success: true, ...diagnose(rows) }]);
  assert.equal(summary.jobYield.uniqueJobs, 2);
  assert.equal(summary.jobYield.duplicateObservations, 0);
});

test('aliases infer shared application pages consistently even with different subsets', () => {
  const shared = id => job(id, { applyUrl: 'https://company.example/careers' });
  const summary = summarizeScraperRun([
    { success: true, ...diagnose([shared('1'), shared('2')]) },
    { success: true, ...diagnose([shared('1')]) },
  ]);
  assert.equal(summary.jobYield.uniqueJobs, 2);
  assert.equal(summary.jobYield.duplicateObservations, 1);
  const distinct = summarizeScraperRun([
    { success: true, ...diagnose([shared('1')]) }, { success: true, ...diagnose([shared('2')]) },
  ]);
  assert.equal(distinct.jobYield.uniqueJobs, 2);
});

test('native role whitespace and case normalization is consistent across aliases', () => {
  const shared = { applyUrl: 'https://company.example/careers' };
  for (const jobs of [[job('REQ  1', shared), job(' req 1 ', shared)],
    [job(null, { ...shared, title: 'Software  Engineer' }), job(null, { ...shared, title: ' software engineer ' })]]) {
    const summary = summarizeScraperRun(jobs.map(row => ({ success: true, ...diagnose([row]) })));
    assert.equal(summary.jobYield.uniqueJobs, 1);
    assert.equal(summary.jobYield.duplicateObservations, 1);
  }
});

test('raw scraper identity aliases match persistence normalization', () => {
  for (const roles of [
    [job(null, { reqId: 'R1', applicationUrlIsGeneric: true }), job(null, { reqId: 'R2', applicationUrlIsGeneric: true })],
    [job(null, { originalTitle: 'Engineer I', applicationUrlIsGeneric: true }), job(null, { originalTitle: 'Engineer II', applicationUrlIsGeneric: true })],
  ]) {
    const rows = roles.map(row => ({ ...row, applyUrl: 'https://company.example/careers' }));
    const storedCount = new Set(resolveApplicationIdentities(rows.map(row => normalizeScrapedJob(row))).map(row => row.fingerprint)).size;
    assert.equal(storedCount, 2);
    const summary = summarizeScraperRun(rows.map(row => ({ success: true, ...diagnose([row]) })));
    assert.equal(summary.jobYield.uniqueJobs, storedCount);
  }
});

test('historical counts without identities do not imply unique jobs', () => {
  const summary = summarizeScraperRun([{ success: true, jobs: 378 }, { success: true, jobs: 378 }]);
  assert.equal(summary.jobYield.observations, 756);
  assert.equal(summary.jobYield.uniqueJobs, null);
  assert.equal(summary.jobYield.duplicateObservations, null);
  assert.equal(summary.jobYield.sourcesWithoutIdentityEvidence, 2);
});

test('execution completion and extraction health remain independent at handoff', () => {
  const summary = summarizeScraperRun([{ success: true, partial: true, jobs: 1 },
    { success: false, softFailure: true }, { success: false, softFailure: false }]);
  const completed = describeStageCompletion('scraper', summary, 'completed');
  assert.equal(completed.handoffReady, true);
  assert.equal(completed.processingComplete, true);
  assert.equal(completed.coverageComplete, false);
  assert.equal(completed.health, 'degraded');
  assert.equal(completed.partialSuccessfulTasks, 1);
  assert.equal(completed.failedTasks, 2);
});

test('real status/history writers and strict schema retain identities and derived health', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => descriptor ? Object.defineProperty(mongoose.connection, 'readyState', descriptor) : delete mongoose.connection.readyState);
  let status, history;
  t.mock.method(ScraperStatus, 'findOneAndUpdate', async (_filter, update) => { status = update.$set.latestAttempt; });
  t.mock.method(ScraperRun, 'create', async data => { history = new ScraperRun(data).toObject({ flattenMaps: true }); });
  const result = { success: true, partial: true, ...diagnose([job('1'), job('2')]) };
  await upsertScraperStatus('aecom', result);
  await writeScraperRun(new Date(), { aecom: result, aecomindia: { success: true, ...diagnose([job('1')]) } });
  assert.deepEqual(status.jobIdentityHashes, result.jobIdentityHashes);
  assert.deepEqual(history.sources.aecom.jobIdentityHashes, result.jobIdentityHashes);
  assert.equal(history.overall.jobYield.uniqueJobs, 2);
  assert.equal(history.overall.jobYield.duplicateObservations, 1);
  assert.equal(history.overall.health, 'degraded');
  assert.equal(history.overall.taskOutcomes.succeeded, 2);
});
