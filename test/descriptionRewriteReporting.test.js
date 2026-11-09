import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRewriteSummaries } from '../rewriting/reporting.js';
import * as reporting from '../rewriting/reporting.js';
import { stageOutcome, describeStageCompletion } from '../src/pipeline/policy.js';

const parts = () => [0, 1, 2, 3].map(shard => ({ shard, shardCount: 4, mode: 'publish', outcome: 'completed',
  queued: 10, attempted: 9, published: 8, failed: 1, skipped: 1, warnings: 1, pendingEstimate: 0,
  startedAt: '2026-10-30T10:00:00.000Z', finishedAt: `2026-10-30T10:00:0${shard + 1}.000Z`,
  environment: { cpuThreads: 4, parallelism: 4 }, results: [{ id: `job-${shard}` }],
}));

test('rewrite reporting sums exclusive queue counters and retains each worker diagnostic', () => {
  const summary = aggregateRewriteSummaries(parts());
  assert.equal(summary.queued, 40);
  assert.equal(summary.attempted, 36);
  assert.equal(summary.published, 32);
  assert.equal(summary.failed, 4);
  assert.equal(summary.skipped, 4);
  assert.equal(summary.warnings, 4);
  assert.equal(summary.pendingEstimate, 0);
  assert.equal(summary.workers.length, 4);
  assert.deepEqual(summary.workers.map(worker => worker.shard), [0, 1, 2, 3]);
  assert.ok(summary.workers.every(worker => worker.environment.cpuThreads === 4 && !worker.results));
  assert.equal(summary.finishedAt, '2026-10-30T10:00:04.000Z');
  assert.equal(stageOutcome('rewrite', summary), 'completed');
  assert.equal(describeStageCompletion('rewrite', summary, 'completed').unpublishedEstimate, 8);
});

test('missing rewrite artifacts block handoff and invalid or duplicate identities fail closed', () => {
  const summary = aggregateRewriteSummaries(parts().slice(0, 3));
  assert.deepEqual(summary.missingShards, [3]);
  assert.equal(stageOutcome('rewrite', summary), 'failed');
  for (const invalid of [[...parts(), parts()[0]], [{ ...parts()[0], shardCount: 1 }, ...parts().slice(1)],
    [null, ...parts().slice(1)], [{ ...parts()[0], queued: -1 }, ...parts().slice(1)]]) {
    assert.throws(() => aggregateRewriteSummaries(invalid), /shard|counter/i);
  }
});

test('one worker execution failure overrides normal budget and quality handoffs', () => {
  const workers = parts();
  Object.assign(workers[0], { reason: 'workflow_budget_exhausted', stopReason: 'budget_exhausted',
    budgetExhausted: true, interrupted: true, pendingEstimate: 5 });
  Object.assign(workers[1], { reason: 'model_quality_unavailable', qualityStopped: true, interrupted: true });
  Object.assign(workers[2], { reason: 'worker_error', errorType: 'RewriteWorkerError', errorPhase: 'process_queue' });
  const summary = aggregateRewriteSummaries(workers);
  assert.deepEqual(summary.failedShards, [2]);
  assert.equal(stageOutcome('rewrite', summary), 'failed');
  assert.equal(summary.workers[2].errorType, 'RewriteWorkerError');
});

test('an incomplete or cancelled worker is not hidden by another worker budget handoff', () => {
  for (const incomplete of [{ pendingEstimate: 5 }, { cancelled: true, stopReason: 'cancelled', interrupted: true }]) {
    const workers = parts();
    Object.assign(workers[0], { budgetExhausted: true, interrupted: true, stopReason: 'budget_exhausted' });
    Object.assign(workers[1], incomplete);
    const summary = aggregateRewriteSummaries(workers);
    assert.deepEqual(summary.incompleteShards, [1]);
    assert.equal(stageOutcome('rewrite', summary), 'incomplete');
  }
});

test('normal worker budget stops retain pending counts and allow classification handoff', () => {
  const workers = parts();
  Object.assign(workers[0], { budgetExhausted: true, interrupted: true, pendingEstimate: 5, stopReason: 'budget_exhausted' });
  const summary = aggregateRewriteSummaries(workers);
  assert.equal(stageOutcome('rewrite', summary), 'completed');
  const completion = describeStageCompletion('rewrite', summary, 'completed');
  assert.equal(completion.processingComplete, false);
  assert.equal(completion.handoffReady, true);
  assert.equal(completion.pendingEstimate, 5);
});

test('capacity counts prose edits and measures fresh inference without deterministic copying', () => {
  assert.equal(typeof reporting.summarizeRewriteCapacity, 'function');
  const capacity = reporting.summarizeRewriteCapacity([
    { ok: true, generated: true, durationMs: 20, generationRequests: 0, renderedWithoutInference: true,
      quality: { modelEditedBlocks: 0, sourcePreservedBlocks: 2, protectedSourceBlocks: 2, sourceFallbackBlocks: 0 } },
    { ok: true, generated: true, durationMs: 30000, generationRequests: 2,
      quality: { modelEditedBlocks: 1, sourcePreservedBlocks: 3, protectedSourceBlocks: 2, sourceFallbackBlocks: 1 } },
    { ok: true, generated: true, durationMs: 40, generationRequests: 0, modelPlanCached: true,
      quality: { modelEditedBlocks: 1, sourcePreservedBlocks: 1, protectedSourceBlocks: 1, sourceFallbackBlocks: 0 } },
    { ok: false, generated: true, durationMs: 50000, generationRequests: 1 },
  ], { startedAt: '2026-10-30T10:00:00Z', finishedAt: '2026-10-30T10:01:00Z', attempted: 4 });
  assert.equal(capacity.p50DurationMs, 50000);
  assert.equal(capacity.p95DurationMs, 50000);
  assert.equal(capacity.freshInferenceDescriptions, 2);
  assert.equal(capacity.modelRequests, 3);
  assert.equal(capacity.modelEditedBlocks, 2);
  assert.equal(capacity.sourcePreservedBlocks, 6);
  assert.equal(capacity.modelEditedDescriptions, 2);
  assert.equal(capacity.sourcePreservedDescriptions, 1);
  assert.equal(capacity.renderedWithoutInference, 1);
  assert.equal(capacity.cachedDescriptions, 1);
  assert.equal(capacity.publishedPerHour, 180);
});

test('aggregate rejects mixed model and policy identities before reporting success', () => {
  const workers = parts().map(part => ({ ...part, policyVersion: 'job-description-prose-v24' }));
  workers[1].policyVersion = 'job-description-prose-v23';
  assert.throws(() => aggregateRewriteSummaries(workers), /identity|policy/i);
});

test('an unpublished guarded-write result contributes inference cost without publication quality or throughput', () => {
  const capacity = reporting.summarizeRewriteCapacity([{ ok: true, published: false, generated: true,
    durationMs: 30000, generationRequests: 1, quality: { modelEditedBlocks: 1, sourcePreservedBlocks: 2 } }],
  { startedAt: '2026-10-30T10:00:00Z', finishedAt: '2026-10-30T10:01:00Z', attempted: 1 });
  assert.equal(capacity.modelRequests, 1);
  assert.equal(capacity.p50DurationMs, 30000);
  assert.equal(capacity.freshInferenceDescriptions, 1);
  assert.equal(capacity.publishedPerHour, 0);
  assert.equal(capacity.modelEditedDescriptions, 0);
  assert.equal(capacity.modelEditedBlocks, 0);
  assert.equal(capacity.sourcePreservedBlocks, 0);
});

test('capacity separates word edits, model formatting and server formatting without inventing historical metrics', () => {
  const capacity = reporting.summarizeRewriteCapacity([
    { ok: true, published: true, generationRequests: 1, transportRetries: 1,
      quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 0, modelLayoutEditedBlocks: 1, layoutParagraphBreaks: 2 } },
    { ok: true, published: true, generationRequests: 1, transportRetries: 0,
      quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 1, modelLayoutEditedBlocks: 0, layoutParagraphBreaks: 0 } },
    { ok: true, published: true, quality: { modelEditedBlocks: 1 } },
    { ok: true, published: false, transportRetries: 2,
      quality: { modelEditedBlocks: 2, modelWordingEditedBlocks: 2, modelLayoutEditedBlocks: 0, layoutParagraphBreaks: 3 } },
  ]);
  assert.equal(capacity.modelEditedBlocks, 3);
  assert.equal(capacity.modelWordingEditedBlocks, 1);
  assert.equal(capacity.modelLayoutEditedBlocks, 1);
  assert.equal(capacity.wordingMetricsRecordedDescriptions, 2);
  assert.equal(capacity.layoutParagraphBreaks, 2);
  assert.equal(capacity.transportRetries, 3);
});


test('structurally empty or unfinished worker artifacts cannot report successful handoff', () => {
  const complete = parts()[0];
  for (const invalid of [
    { shard: 0, shardCount: 4 },
    { ...complete, mode: undefined },
    { ...complete, outcome: undefined },
    { ...complete, outcome: 'success' },
    { ...complete, queued: undefined },
    { ...complete, pendingEstimate: undefined },
    { ...complete, mode: 'preview', reason: 'read_only_preview' },
    { ...complete, mode: 'preview', queued: 0, reason: undefined },
  ]) assert.throws(() => aggregateRewriteSummaries([invalid, ...parts().slice(1)]), /shard/i);
});

test('empty preview and explicit stops before queue counting remain valid worker reports', () => {
  const common = { shard: 0, shardCount: 4 };
  for (const [worker, expected] of [
    [{ ...common, mode: 'preview', reason: 'read_only_preview', queued: 0 }, 'completed'],
    [{ ...common, mode: 'publish', outcome: 'completed', reason: 'workflow_budget_exhausted',
      interrupted: true, budgetExhausted: true, stopReason: 'budget_exhausted' }, 'completed'],
    [{ ...common, mode: 'publish', outcome: 'failed', reason: 'worker_error', errorType: 'MongoServerError' }, 'failed'],
    [{ ...common, mode: 'publish', outcome: 'incomplete', reason: 'interrupted',
      interrupted: true, cancelled: true, stopReason: 'cancelled' }, 'incomplete'],
    [{ ...common, mode: 'off', outcome: 'failed', reason: 'disabled' }, 'failed'],
  ]) assert.equal(stageOutcome('rewrite', aggregateRewriteSummaries([worker, ...parts().slice(1)])), expected);
});

test('explicit incomplete worker outcomes cannot be upgraded by missing stop details', () => {
  const workers = parts();
  workers[0].outcome = 'incomplete';
  assert.equal(stageOutcome('rewrite', aggregateRewriteSummaries(workers)), 'incomplete');
});
test('capacity reports correction cost and wording throughput separately from publication success', () => {
  const capacity = reporting.summarizeRewriteCapacity([
    { ok: true, published: true, correctionRequests: 2, correctionsAccepted: 1, correctionsRejected: 1, correctionsSkipped: 3,
      quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 1, modelLayoutEditedBlocks: 0 } },
    { ok: true, published: true, correctionRequests: 1, correctionsAccepted: 1, correctionsRejected: 0, correctionsSkipped: 0,
      quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 0, modelLayoutEditedBlocks: 1 } },
    { ok: true, published: false, correctionRequests: 5, correctionsAccepted: 2, correctionsRejected: 3, correctionsSkipped: 1,
      quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 1, modelLayoutEditedBlocks: 0 } },
  ], { startedAt: '2026-11-07T00:00:00Z', finishedAt: '2026-11-07T00:01:00Z' });
  assert.equal(capacity.publishedPerHour, 120);
  assert.equal(capacity.modelEditedDescriptionsPerHour, 120);
  assert.equal(capacity.modelWordingEditedDescriptionsPerHour, 60);
  assert.equal(capacity.modelLayoutOnlyDescriptionsPerHour, 60);
  assert.equal(capacity.correctionRequests, 8);
  assert.equal(capacity.correctionsAccepted, 4);
  assert.equal(capacity.correctionsRejected, 4);
  assert.equal(capacity.correctionsSkipped, 4);
  const old = reporting.summarizeRewriteCapacity([{ ok: true, quality: { modelEditedBlocks: 1 } }]);
  assert.equal(old.modelWordingEditedDescriptionsPerHour, null);
});
