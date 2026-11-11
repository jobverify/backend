import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { rewriteCandidates, rewriteProgress } from '../rewriting/runner.js';
import { summarizeRewriteCapacity, aggregateRewriteSummaries } from '../rewriting/reporting.js';
import { describeStageCompletion } from '../src/pipeline/policy.js';
import { buildRewritePlan } from '../rewriting/partitioning.js';
import * as reporting from '../rewriting/reporting.js';

test('cutoff attempts remain queued and report spent inference without becoming publication failures', async () => {
  const controller = new AbortController(), rows = [];
  const sourceDescription = 'Build Python services.';
  const inputHash = buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription }).inputHash;
  const job = { _id: 'pending', title: 'Engineer', company: 'Example', sourceDescription, sourceContentHash: inputHash,
    status: 'active', descriptionRewrite: { status: 'pending', inputHash } };
  const stats = await rewriteCandidates([job], { signal: controller.signal, deadline: Date.now() + 10000,
    client: { generate: async (_input, { onInterrupted }) => {
      onInterrupted?.({ generationRequests: 5, correctionRequests: 2, correctionsAccepted: 1, correctionsRejected: 1 });
      controller.abort();
      throw controller.signal.reason;
    } },
    update: async () => assert.fail('interrupted jobs must keep their durable pending state'),
    onResult: row => rows.push(row) });
  assert.equal(stats.attempted, 1);
  assert.equal(stats.interruptedAttempts, 1);
  assert.equal(stats.failed, 0);
  assert.equal(stats.published, 0);
  assert.equal(rewriteProgress({ ...stats, queued: 1 }).pendingEstimate, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].interrupted, true);
  assert.equal(rows[0].published, false);
  const capacity = summarizeRewriteCapacity(rows);
  assert.equal(capacity.modelRequests, 5);
  assert.equal(capacity.correctionRequests, 2);
  assert.equal(capacity.interruptedDescriptions, 1);
  assert.equal(capacity.p50DurationMs, null, 'unfinished descriptions cannot contribute complete latency');
});

test('capacity reports measured edit yield and corrections without classifying historical rows', () => {
  const rows = [
    { ok: true, quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 1, modelLayoutEditedBlocks: 0, sourceFallbackBlocks: 1 }, correctionRequests: 4, correctionsAccepted: 1 },
    { ok: true, quality: { modelEditedBlocks: 1, modelWordingEditedBlocks: 0, modelLayoutEditedBlocks: 1, sourceFallbackBlocks: 0 } },
    { ok: true, quality: { modelEditedBlocks: 0, modelWordingEditedBlocks: 0, modelLayoutEditedBlocks: 0, sourceFallbackBlocks: 0 } },
    { ok: false, interrupted: true, generationRequests: 2 },
  ];
  const capacity = summarizeRewriteCapacity(rows);
  assert.equal(capacity.modelWordingEditRate, 1 / 3);
  assert.equal(capacity.modelLayoutOnlyRate, 1 / 3);
  assert.equal(capacity.sourceFallbackRate, 1 / 3);
  assert.equal(capacity.correctionAcceptanceRate, 1 / 4);
  assert.equal(summarizeRewriteCapacity([{ ok: true }]).modelWordingEditRate, null);
  assert.equal(summarizeRewriteCapacity([]).correctionAcceptanceRate, null);
});

test('automatic partitions distribute the queue over the configured runner pool and expose scheduling waves', () => {
  const plan = buildRewritePlan(27826);
  assert.equal(plan.shardCount, 128);
  assert.equal(plan.estimatedJobsPerShard, 218);
  assert.equal(plan.capacityLimited, false);
  assert.equal(plan.plannedWaves, 2);
  const fixed = buildRewritePlan(27826, { shardCount: 32, jobsPerShard: 350 });
  assert.equal(fixed.capacityLimited, true);
  assert.equal(buildRewritePlan(27826, { maxParallel: 20 }).plannedWaves, 4);
});

test('a partial handoff has explicit processing status and a report that distinguishes publication from wording edits', () => {
  const summary = describeStageCompletion('rewrite', { queued: 10, published: 6, pendingEstimate: 4,
    budgetExhausted: true, interrupted: true, sourceFallbackDescriptions: 5,
    capacity: { modelWordingEditedDescriptions: 1, modelLayoutOnlyDescriptions: 2,
      sourcePreservedDescriptions: 3, wordingMetricsRecordedDescriptions: 6, modelWordingEditRate: 1 / 6,
      modelLayoutOnlyRate: 2 / 6, peakActiveRunners: 2, runnerHours: 4 } }, 'completed');
  assert.equal(summary.handoffReady, true);
  assert.equal(summary.processingComplete, false);
  assert.equal(summary.processingStatus, 'partial');
  assert.equal(typeof reporting.formatRewriteReport, 'function');
  const text = reporting.formatRewriteReport(summary);
  assert.match(text, /Processing: partial/);
  assert.match(text, /Published \| 6/);
  assert.match(text, /Pending estimate \| 4/);
  assert.match(text, /Wording edits \| 1 \(16\.7%\)/);
  assert.match(text, /Peak active processing runners \| 2/);
  assert.match(reporting.formatRewriteReport({ published: 2, capacity: { modelWordingEditedDescriptions: 0 } }), /Wording edits \| Not measured/);
});

test('aggregate reports actual runner overlap separately from wall-clock throughput', () => {
  const workers = [
    { shard: 0, startedAt: '2026-11-11T00:00:00Z', finishedAt: '2026-11-11T01:00:00Z' },
    { shard: 1, startedAt: '2026-11-11T00:00:00Z', finishedAt: '2026-11-11T01:00:00Z' },
    { shard: 2, startedAt: '2026-11-11T01:00:00Z', finishedAt: '2026-11-11T02:00:00Z' },
    { shard: 3, startedAt: '2026-11-11T01:00:00Z', finishedAt: '2026-11-11T02:00:00Z' },
  ].map(worker => ({ ...worker, shardCount: 4, mode: 'publish', outcome: 'completed', queued: 1, published: 1, pendingEstimate: 0,
    results: [{ ok: true, published: true }] }));
  const summary = aggregateRewriteSummaries(workers);
  assert.equal(summary.capacity.runnerHours, 4);
  assert.equal(summary.capacity.peakActiveRunners, 2);
  assert.equal(summary.capacity.averageActiveRunners, 2);
  assert.equal(summary.capacity.publishedPerRunnerHour, 1);
  assert.equal(summary.capacity.runnerTimingSamples, 4);
  assert.equal(summary.capacity.runnerTimingBasis, 'rewrite_process');
});

test('missing shard summaries cannot produce complete runner utilization metrics', () => {
  const summary = aggregateRewriteSummaries([{ shard: 0, shardCount: 4, mode: 'publish', outcome: 'completed',
    startedAt: '2026-11-11T00:00:00Z', finishedAt: '2026-11-11T01:00:00Z',
    queued: 1, published: 1, pendingEstimate: 0, results: [{ ok: true }] }]);
  assert.deepEqual(summary.missingShards, [1, 2, 3]);
  assert.equal(summary.capacity.runnerTimingSamples, 1);
  assert.equal(summary.capacity.runnerHours, null);
  assert.equal(summary.capacity.peakActiveRunners, null);
  assert.equal(summary.capacity.averageActiveRunners, null);
  assert.equal(summary.capacity.publishedPerRunnerHour, null);
});
