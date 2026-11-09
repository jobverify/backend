import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeScraperRun } from '../scraper-support/utils/scraperRunSummary.js';

test('unfinished database persistence is pending work rather than completed or failed execution', () => {
  const summary = summarizeScraperRun([
    { success: false, softFailure: true, persistencePending: true, processingComplete: false },
    { success: true, inserted: 2 },
    { success: false, softFailure: true, persistencePending: true, classificationPending: true },
  ]);
  assert.equal(summary.pendingEstimate, 2);
  assert.equal(summary.failed, 0);
});

test('source task outcomes partition the run independently of overlapping legacy warnings', () => {
  const summary = summarizeScraperRun([
    { success: true, inserted: 2, updated: 3, detailHealth: { complete: true },
      inventoryEvidence: { firstParty: true, listingComplete: true, status: 'complete-inventory',
        surface: 'https://example.invalid/careers', pagesFetched: 1, verifiedAt: new Date().toISOString() } },
    { success: true, skipped: true },
    { success: false, softFailure: true },
    { success: false, softFailure: false },
  ]);
  assert.deepEqual(summary.taskOutcomes, { succeeded: 1, skipped: 1, softFailed: 1, hardFailed: 1 });
  assert.equal(Object.values(summary.taskOutcomes).reduce((a, b) => a + b), summary.scanned);
  assert.equal(summary.warnings, 2);
  assert.equal(summary.completed, 2);
  assert.equal(summary.inventoryChecks.complete, 1);
  assert.equal(summary.inventoryChecks.withoutCompleteEvidence, 3);
  assert.equal(summary.inserted, 2);
});

test('complete extraction counts reject partial details, missing evidence and contradictory zero results', () => {
  const completedAt = '2026-10-24T08:00:00.000Z';
  const evidence = { firstParty: true, listingComplete: true, status: 'complete-inventory',
    surface: 'https://example.invalid/careers', pagesFetched: 1, verifiedAt: completedAt };
  const summary = summarizeScraperRun([
    { success: true, completedAt, inventoryEvidence: evidence, detailHealth: { complete: true } },
    { success: true, completedAt, inventoryEvidence: evidence, detailHealth: { complete: false }, inserted: 5 },
    { success: true, completedAt, inventoryEvidence: evidence, partial: true, updated: 3 },
    { success: true, completedAt, inventoryEvidence: evidence, zeroJobEvidence: 'blocked-zero' },
    { success: true },
    { success: true, skipped: true, completedAt, inventoryEvidence: evidence },
  ]);
  assert.deepEqual(summary.taskOutcomes, { succeeded: 4, skipped: 1, softFailed: 1, hardFailed: 0 });
  assert.equal(summary.completed, 5);
  assert.equal(summary.warnings, 1);
  assert.equal(summary.failed, 0);
  assert.equal(Object.values(summary.taskOutcomes).reduce((sum, count) => sum + count, 0), summary.scanned);
  assert.equal(summary.inventoryChecks.complete, 5);
  assert.deepEqual(summary.extractionChecks, { complete: 1, incomplete: 5 });
  assert.equal(summary.inserted, 5);
  assert.equal(summary.updated, 3);
});

test('inventory checks validate fetched evidence at completion rather than trusting labels or current age', () => {
  const completedAt = '2026-09-01T08:00:00.000Z';
  const evidence = { firstParty: true, listingComplete: true, status: 'verified-empty',
    surface: 'https://example.invalid/careers', pagesFetched: 1, reportedTotal: 0, verifiedAt: completedAt };
  const summary = summarizeScraperRun([
    { success: true, completedAt, inventoryEvidence: evidence },
    { success: true, completedAt, inventoryEvidence: { ...evidence, verifiedAt: '2026-08-01T08:00:00.000Z' } },
    { success: true, completedAt, inventoryEvidence: { ...evidence, surface: null } },
    { success: true, completedAt, inventoryEvidence: { ...evidence, reportedTotal: 5 } },
  ]);
  assert.deepEqual(summary.inventoryChecks, { complete: 1, withoutCompleteEvidence: 3 });
  assert.deepEqual(summary.extractionChecks, { complete: 1, incomplete: 3 });
});
