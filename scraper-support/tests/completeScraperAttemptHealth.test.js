import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ScraperStatus from '../../src/models/ScraperStatus.js';
import ScraperRun from '../../src/models/ScraperRun.js';
import * as evidenceHelpers from '../utils/inventoryEvidence.js';
import { upsertScraperStatus, writeScraperRun, markPipelineRunStarted } from '../utils/scraperPersistence.js';
import { buildPublishingGapReport } from '../../scripts/publishingGapReport.js';
import { openRunCheckpoint } from '../utils/runCheckpoint.js';

const fixture = (overrides = {}) => {
  const completedAt = new Date(Date.now() - 1000).toISOString();
  return { success: true, jobs: 5, eligibleJobs: 4, rawRecords: 7,
    completedAt, attemptedAt: new Date(+new Date(completedAt) - 1000).toISOString(),
    inventoryEvidence: { status: 'complete-inventory', firstParty: true, listingComplete: true,
      surface: 'https://example.invalid/careers', pagesFetched: 1, reportedTotal: 7, verifiedAt: completedAt },
    ...overrides };
};
const flagged = [{ partial: true }, { softFailure: true }, { upstreamOutage: true }, { skipped: true },
  { failureKind: 'coverage_gap' }, { failureKind: 'network_or_timeout' },
  { zeroJobEvidence: 'coverage-gap' }, { zeroJobEvidence: 'unverified-zero' }, { zeroJobEvidence: 'blocked-zero' }];
const reportFor = (attempt, now = new Date(), status = {}) => buildPublishingGapReport({
  catalog: [{ source: 'health-example', companyName: 'Health Example', adapter: 'workday' }], now,
  runtime: { databaseAvailable: true, generatedAt: now.toISOString(), publicCompanyNames: [], inventory: [],
    statuses: [{ source: 'health-example', ...status, latestAttempt: attempt }] },
});
async function withCapturedWrites(callback) {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  const originalUpdate = ScraperStatus.findOneAndUpdate, originalCreate = ScraperRun.create;
  const updates = [], histories = [];
  ScraperStatus.findOneAndUpdate = async (_filter, update) => { updates.push(update); return {}; };
  ScraperRun.create = async value => { histories.push(new ScraperRun(value).toObject()); return {}; };
  try { await callback({ updates, histories }); }
  finally {
    ScraperStatus.findOneAndUpdate = originalUpdate; ScraperRun.create = originalCreate;
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor); else delete mongoose.connection.readyState;
  }
}
const assertNoCompleteOverwrite = set => {
  for (const key of ['lastCompleteCheckAt', 'lastCompleteJobsFound', 'lastCompleteEligibleJobsFound']) assert.equal(Object.hasOwn(set, key), false, key);
};

test('processing-complete partial saves retain audit counts and never overwrite complete check state', async () => {
  await withCapturedWrites(async ({ updates, histories }) => {
    const attempt = fixture({ partial: true, processingComplete: true, inserted: 2, updated: 3,
      detailHealth: { complete: false, incompleteJobs: 1 } });
    await upsertScraperStatus('health-example', attempt);
    await writeScraperRun(new Date(), { 'health-example': attempt });
    assertNoCompleteOverwrite(updates.at(-1).$set);
    const saved = histories[0].sources.get('health-example');
    assert.equal(saved.processingComplete, true);
    assert.equal(saved.partial, true);
    assert.equal(saved.inserted, 2);
    assert.equal(saved.updated, 3);
    assert.equal(saved.detailHealth.complete, false);
    assert.equal(histories[0].overall.totalJobs, 5);
  });
});

test('history normalizes resumed unavailable and skipped attempts while retaining saved partial jobs', async () => {
  await withCapturedWrites(async ({ histories }) => {
    const empty = fixture({ jobs: 0, eligibleJobs: 0, zeroJobEvidence: 'verified-empty', processingComplete: true });
    empty.inventoryEvidence = { ...empty.inventoryEvidence, status: 'verified-empty', reportedTotal: 0, indiaFacetCount: 0 };
    await writeScraperRun(new Date(), {
      blocked: fixture({ success: true, jobs: 0, eligibleJobs: 0, zeroJobEvidence: 'blocked-zero',
        inventoryEvidence: { status: 'discovery-only', firstParty: false, listingComplete: false } }),
      unverified: fixture({ success: true, jobs: 0, eligibleJobs: 0, zeroJobEvidence: 'unverified-zero', inventoryEvidence: null }),
      skipped: { success: true, skipped: true, jobs: 0 },
      partial: fixture({ success: true, partial: true, processingComplete: true, inserted: 2, updated: 3,
        detailHealth: { complete: false, incompleteJobs: 1 } }),
      empty,
    });
    const history = histories[0], sources = history.sources;
    assert.equal(sources.get('blocked').success, false);
    assert.equal(sources.get('blocked').softFailure, true);
    assert.equal(sources.get('blocked').failureKind, 'coverage_gap');
    assert.equal(sources.get('blocked').partial, true);
    assert.equal(sources.get('blocked').processingComplete, null);
    assert.equal(sources.get('blocked').zeroJobEvidence, 'blocked-zero');
    assert.equal(sources.get('blocked').inventoryEvidence.status, 'discovery-only');
    assert.equal(sources.get('unverified').success, false);
    assert.equal(sources.get('unverified').softFailure, true);
    assert.equal(sources.get('unverified').failureKind, 'coverage_gap');
    assert.equal(sources.get('unverified').upstreamOutage, false);
    assert.equal(sources.get('unverified').partial, true);
    assert.equal(sources.get('unverified').processingComplete, null);
    assert.equal(sources.get('unverified').inventoryEvidence, null);
    assert.equal(sources.get('skipped').success, false);
    assert.equal(sources.get('skipped').skipped, true);
    assert.equal(sources.get('partial').success, true);
    assert.equal(sources.get('partial').jobsFound, 5);
    assert.equal(sources.get('partial').inserted, 2);
    assert.equal(sources.get('partial').updated, 3);
    assert.equal(sources.get('partial').detailHealth.complete, false);
    assert.equal(sources.get('empty').success, true);
    assert.equal(sources.get('empty').jobsFound, 0);
    assert.deepEqual(history.overall, {
      taskOutcomes: { succeeded: 2, skipped: 1, softFailed: 2, hardFailed: 0 },
      inventoryChecks: { complete: 2, withoutCompleteEvidence: 3 },
      extractionChecks: { complete: 1, incomplete: 4 },
      jobYield: { observations: 5, uniqueJobs: null, duplicateObservations: null, sourcesWithoutIdentityEvidence: 1 },
      health: 'degraded', coverageComplete: false, partialSuccessfulTasks: 1, failedTasks: 2,
      totalJobs: 5, sourcesSucceeded: 2, sourcesFailed: 2,
    });
    assert.equal(new ScraperRun(history).validateSync(), undefined);
  });
});

test('legacy successful counters stay compatible without becoming evidence-backed complete counters', async () => {
  await withCapturedWrites(async ({ updates }) => {
    await upsertScraperStatus('health-example', { success: true, jobs: 5, eligibleJobs: 4 });
    const set = updates.at(-1).$set;
    assert.equal(set.lastJobsFound, 5); assert.equal(set.lastEligibleJobsFound, 4);
    assertNoCompleteOverwrite(set);
    assert.equal(set.latestAttempt.inventoryEvidence, null);
  });
});

test('explicit incomplete and failure flags preserve complete history even beside complete inventory evidence', async () => {
  await withCapturedWrites(async ({ updates }) => {
    for (const flags of flagged) {
      const attempt = fixture(flags); await upsertScraperStatus('health-example', attempt);
      const set = updates.at(-1).$set; assertNoCompleteOverwrite(set);
      assert.equal(Object.hasOwn(set, 'lastJobsFound'), false);
      assert.equal(set.latestAttempt.jobs, 5); assert.equal(set.latestAttempt.eligibleJobs, 4);
      for (const [key, value] of Object.entries(flags)) assert.equal(set.latestAttempt[key], value);
    }
  });
});

test('report completion timestamp and counters share the same semantic failure guard', () => {
  for (const flags of flagged) {
    const report = reportFor(fixture(flags));
    assert.equal(report.rows[0].completeSuccessfulCheck, false, JSON.stringify(flags));
    assert.equal(report.rows[0].lastCompleteCheckAt, null, JSON.stringify(flags));
    assert.equal(report.summary.completeSuccessfulChecks, 0);
    assert.equal(report.rows[0].indiaJobs, 5);
  }
});

test('unverified-zero flags cannot certify zero inventories through conflicting verified-empty metadata', () => {
  for (const flags of [{ zeroJobEvidence: 'unverified-zero' }, { zeroJobEvidence: 'blocked-zero' }, { zeroJobEvidence: 'coverage-gap' }]) {
    const attempt = fixture({ jobs: 0, eligibleJobs: 0, ...flags });
    attempt.inventoryEvidence = { ...attempt.inventoryEvidence, status: 'verified-empty', reportedTotal: 0, indiaFacetCount: 0 };
    const report = reportFor(attempt);
    assert.equal(report.summary.verifiedZeroInventories, 0); assert.equal(report.summary.completeSuccessfulChecks, 0);
    assert.equal(report.rows[0].lastCompleteCheckAt, null);
  }
});

test('real complete positive and verified-empty checks still advance timestamp and explicit counts', async () => {
  await withCapturedWrites(async ({ updates }) => {
    for (const empty of [false, true]) {
      const attempt = fixture(empty ? { jobs: 0, eligibleJobs: 0, zeroJobEvidence: 'verified-empty' } : {});
      if (empty) attempt.inventoryEvidence = { ...attempt.inventoryEvidence, status: 'verified-empty', reportedTotal: 0, indiaFacetCount: 0 };
      await upsertScraperStatus('health-example', attempt); const set = updates.at(-1).$set;
      assert.equal(set.lastCompleteCheckAt.toISOString(), attempt.completedAt);
      assert.equal(set.lastCompleteJobsFound, attempt.jobs); assert.equal(set.lastCompleteEligibleJobsFound, attempt.eligibleJobs);
      const report = reportFor(attempt); assert.equal(report.summary.completeSuccessfulChecks, 1);
      assert.equal(report.summary.verifiedZeroInventories, empty ? 1 : 0);
    }
  });
});

test('complete-count defaults and missing eligible metrics remain unknown while explicit zero survives', async () => {
  const missing = new ScraperStatus({ source: 'missing', lastSuccess: true, lastRanAt: new Date() }).toObject();
  assert.equal(missing.lastCompleteJobsFound, null); assert.equal(missing.lastCompleteEligibleJobsFound, null);
  const zero = new ScraperStatus({ source: 'zero', lastSuccess: true, lastRanAt: new Date(), lastCompleteJobsFound: 0, lastCompleteEligibleJobsFound: 0 }).toObject();
  assert.equal(zero.lastCompleteJobsFound, 0); assert.equal(zero.lastCompleteEligibleJobsFound, 0);
  await withCapturedWrites(async ({ updates }) => {
    const attempt = fixture(); delete attempt.eligibleJobs;
    await upsertScraperStatus('health-example', attempt); const set = updates.at(-1).$set;
    assert.equal(set.lastCompleteJobsFound, 5); assert.equal(set.lastCompleteEligibleJobsFound, null);
    assert.equal(set.lastEligibleJobsFound, 5); // Legacy counter compatibility; not the complete-check metric.
    assert.equal(set.latestAttempt.eligibleJobs, null);
    await markPipelineRunStarted(new Date());
    assert.equal(updates.at(-1).$setOnInsert.lastCompleteJobsFound, null);
    assert.equal(updates.at(-1).$setOnInsert.lastCompleteEligibleJobsFound, null);
  });
});

test('history preserves partial/skipped flags and leaves unobserved historical flags null', async () => {
  await withCapturedWrites(async ({ histories }) => {
    await writeScraperRun(new Date(), { flagged: fixture({ partial: true, skipped: false }), skipped: fixture({ skipped: true }), legacy: { success: true } });
    const sources = histories[0].sources;
    assert.equal(sources.get('flagged').partial, true); assert.equal(sources.get('flagged').skipped, false);
    assert.equal(sources.get('skipped').skipped, true);
    assert.equal(sources.get('legacy').partial, null); assert.equal(sources.get('legacy').skipped, null);
  });
});

test('historical fully evidenced checks retain their original clock but are stale in current coverage', async () => {
  await withCapturedWrites(async ({ updates }) => {
    const completedAt = new Date(Date.now() - 72 * 3600000).toISOString(), attempt = fixture({ completedAt });
    attempt.inventoryEvidence.verifiedAt = completedAt;
    await upsertScraperStatus('health-example', attempt);
    assert.equal(updates.at(-1).$set.lastCompleteCheckAt.toISOString(), completedAt);
    const report = reportFor(attempt, new Date(), { lastCompleteCheckAt: completedAt });
    assert.equal(report.summary.completeSuccessfulChecks, 0); assert.equal(report.rows[0].attemptFresh, false);
    assert.equal(report.rows[0].lastCompleteCheckAt, completedAt);
  });
});

test('future or invalid completion times never become complete-check history', async () => {
  await withCapturedWrites(async ({ updates }) => {
    for (const completedAt of [new Date(Date.now() + 86400000).toISOString(), 'not-a-date', 0]) {
      const attempt = fixture({ completedAt }); if (typeof completedAt === 'string' && completedAt !== 'not-a-date') attempt.inventoryEvidence.verifiedAt = completedAt;
      await upsertScraperStatus('health-example', attempt); assertNoCompleteOverwrite(updates.at(-1).$set);
      assert.equal(reportFor(attempt).summary.completeSuccessfulChecks, 0);
    }
  });
});

test('shared attempt helper combines explicit health flags with first-party evidence at the completion clock', () => {
  assert.equal(typeof evidenceHelpers.isCompleteScraperAttempt, 'function');
  const attempt = fixture(); assert.equal(evidenceHelpers.isCompleteScraperAttempt(attempt), true);
  for (const flags of flagged) assert.equal(evidenceHelpers.isCompleteScraperAttempt({ ...attempt, ...flags }), false);
  assert.equal(evidenceHelpers.isCompleteScraperAttempt({ ...attempt, inventoryEvidence: null }), false);
  assert.equal(evidenceHelpers.isCompleteScraperAttempt({ ...attempt, inventoryEvidence: { ...attempt.inventoryEvidence, firstParty: false } }), false);
});

test('legacy soft-failure metadata stays truthful beside a positive success boolean and clears on recovery', async () => {
  await withCapturedWrites(async ({ updates }) => {
    const attempt = fixture({ softFailure: true, upstreamOutage: true, failureKind: 'network_or_timeout', error: 'Partial upstream outage' });
    await upsertScraperStatus('health-example', attempt); const failed = updates.at(-1).$set;
    assert.equal(failed.lastSuccess, true); assert.equal(failed.softFailure, true); assert.equal(failed.upstreamOutage, true);
    assert.equal(failed.failureKind, 'network_or_timeout'); assert.equal(failed.lastError, 'Partial upstream outage');
    assertNoCompleteOverwrite(failed);
    await upsertScraperStatus('health-example', fixture()); const recovered = updates.at(-1).$set;
    assert.equal(recovered.softFailure, false); assert.equal(recovered.upstreamOutage, false);
    assert.equal(recovered.failureKind, null); assert.equal(recovered.lastError, null);
    assert.equal(recovered.lastCompleteJobsFound, 5);
  });
});

test('missing completion time uses the explicit evidence clock without inventing a completion timestamp', async () => {
  await withCapturedWrites(async ({ updates }) => {
    const attempt = fixture({ completedAt: null });
    await upsertScraperStatus('health-example', attempt);
    assert.equal(updates.at(-1).$set.lastCompleteCheckAt.toISOString(), attempt.inventoryEvidence.verifiedAt);
    assert.equal(updates.at(-1).$set.latestAttempt.completedAt, null);
    assert.equal(reportFor(attempt).rows[0].lastCompleteCheckAt, attempt.inventoryEvidence.verifiedAt);
  });
});

test('checkpoint resume preserves partial and detail-health evidence before completion is classified', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-health-'));
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
  try {
    const options = { filePath: path.join(directory, 'checkpoint.json'), sources: ['partial', 'detail'], mode: 'dry', parallel: false };
    const checkpoint = openRunCheckpoint(options);
    checkpoint.markSourceCompleted('partial', fixture({ partial: true }));
    const detailHealth = { complete: false, inspectedJobs: 5, incompleteJobs: 1, missingDescriptions: 0, failureKinds: { 'detail-budget-exhausted': 1 } };
    checkpoint.markSourceCompleted('detail', fixture({ detailHealth }));
    const resumed = openRunCheckpoint(options).completedSummary();
    assert.equal(resumed.partial.partial, true); assert.deepEqual(resumed.detail.detailHealth, detailHealth);
    const report = buildPublishingGapReport({ catalog: options.sources.map(source => ({ source, adapter: 'workday' })), now: new Date(), runState: JSON.parse(fs.readFileSync(options.filePath, 'utf8')) });
    assert.equal(report.summary.completeSuccessfulChecks, 0);
    assert.ok(report.rows.every(row => row.runtimeOutcome === 'partial' && row.lastCompleteCheckAt === null));
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
