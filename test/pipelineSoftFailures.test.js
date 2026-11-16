import test from 'node:test';
import assert from 'node:assert/strict';
import { stageOutcome, describeStageCompletion } from '../src/pipeline/policy.js';
import { summarizeScraperRun } from '../scraper-support/utils/scraperRunSummary.js';
import { isFatalProcessingError, ModelResponseError } from '../src/pipeline/processingErrors.js';

const softResults = {
  scraper: { scanned: 4566, failed: 6, warnings: 2917, pendingEstimate: 1,
    taskOutcomes: { succeeded: 1649, skipped: 0, softFailed: 2911, hardFailed: 6 },
    extractionChecks: { complete: 381, incomplete: 4185 } },
  rewrite: { queued: 100, published: 90, failed: 4, pendingEstimate: 6, stale: 1,
    staleSources: 2, concurrentChanges: 1 },
  classification: { completed: 90, failed: 4, stale: 2, leased: 1,
    batchEligibility: { failed: 2, stale: 1, pending: 6, leased: 1, budgetExhausted: true } },
};

for (const [key, summary] of Object.entries(softResults)) {
  test(`${key} item failures and pending work allow handoff with partial processing`, () => {
    const outcome = stageOutcome(key, summary, 0);
    assert.equal(outcome, 'completed');
    const completion = describeStageCompletion(key, summary, outcome);
    assert.equal(completion.handoffReady, true);
    assert.equal(completion.processingComplete, false);
    assert.equal(completion.processingStatus, 'partial');
    assert.equal(completion.failed, summary.failed);
    if (summary.batchEligibility) assert.deepEqual(completion.batchEligibility, summary.batchEligibility);
  });

  test(`${key} budget stops hand off while execution failures and cancellation still block`, () => {
    const budget = { ...summary, interrupted: true, budgetExhausted: true,
      stopReason: 'budget_exhausted', reason: 'workflow_budget_exhausted' };
    assert.equal(stageOutcome(key, budget, 0), 'completed');
    assert.equal(stageOutcome(key, budget, 1), 'failed');
    for (const errorType of ['SyntaxError', 'ReferenceError', 'TypeError', 'RangeError',
      'MongoServerError', 'MongooseServerSelectionError']) {
      assert.equal(stageOutcome(key, { ...budget, errorType }, 0), 'failed', errorType);
    }
    for (const stopReason of ['database_unavailable', 'runner_error', 'run_lease_held']) {
      assert.equal(stageOutcome(key, { ...budget, stopReason }, 0), 'failed', stopReason);
    }
    assert.equal(stageOutcome(key, { ...budget, persistencePending: 1 }, 0), 'failed');
    assert.equal(stageOutcome(key, { ...budget, cancelled: true, stopReason: 'cancelled' }, 0), 'incomplete');
    assert.equal(stageOutcome(key, { interrupted: true }, 0), 'incomplete');
  });
}

test('scraper summaries distinguish unfinished business work from failed MongoDB persistence', () => {
  const pending = summarizeScraperRun([{ success: true, classificationPending: true }]);
  assert.equal(pending.persistencePending, 0);
  assert.equal(stageOutcome('scraper', pending, 0), 'completed');
  for (const summary of [
    summarizeScraperRun([{ success: false, softFailure: true, persistencePending: true }]),
    summarizeScraperRun([], { persistencePending: true }),
  ]) {
    assert.equal(summary.persistencePending, 1);
    assert.equal(stageOutcome('scraper', summary, 0), 'failed');
  }
});

test('a fully processed stage remains complete without inventing warnings', () => {
  for (const key of Object.keys(softResults)) {
    const summary = describeStageCompletion(key, { completed: 10 }, stageOutcome(key, { completed: 10 }, 0));
    assert.equal(summary.handoffReady, true);
    assert.equal(summary.processingComplete, true);
    assert.equal(summary.processingStatus, 'complete');
  }
});

test('a model response wrapper cannot hide memory or MongoDB causes', () => {
  for (const cause of [Object.assign(new TypeError('fetch failed'), { code: 'ENOMEM' }),
    Object.assign(new Error('offline'), { name: 'MongoNetworkError' })]) {
    assert.equal(isFatalProcessingError(new ModelResponseError('Model unavailable', { cause })), true);
  }
});
