import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRewriteSummaries, formatRewriteReport } from '../rewriting/reporting.js';

const worker = shard => ({ mode: 'publish', outcome: 'completed', shard, shardCount: 2,
  queued: 10, attempted: 0, published: 0, pendingEstimate: 10, qualityStopped: true,
  reason: 'model_quality_unavailable', stopReason: 'readiness_rejected',
  workerProbe: { requests: 4, ready: false, generationRequests: 8, correctionRequests: 4,
    correctionsAccepted: 0, correctionsRejected: 4, correctionsSkipped: 0,
    probes: Array.from({ length: 4 }, (_, slot) => ({ slot, outcome: 'rejected' })) },
});

test('aggregate reports reveal readiness failure and costs separately from untouched production work', () => {
  const summary = aggregateRewriteSummaries([worker(0), worker(1)], { shardCount: 2 });
  assert.equal(summary.attempted, 0);
  assert.equal(summary.capacity.modelRequests, 0);
  assert.deepEqual(summary.readiness, { checks: 8, passed: 0, rejected: 8, failed: 0,
    generationRequests: 16, correctionRequests: 8, correctionsAccepted: 0, correctionsRejected: 8, correctionsSkipped: 0 });
  const report = formatRewriteReport(summary);
  assert.match(report, /model_quality_unavailable.*readiness_rejected/);
  assert.match(report, /Readiness checks \| 8/);
  assert.match(report, /Readiness generation requests \| 16/);
  assert.match(report, /Production model requests \| 0/);
});

test('single-worker reports show readiness costs and legacy summaries leave unknown costs unmeasured', () => {
  const current = formatRewriteReport(worker(0));
  assert.match(current, /Readiness generation requests \| 8/);
  const legacy = worker(1);
  for (const field of ['generationRequests', 'correctionRequests', 'correctionsAccepted', 'correctionsRejected', 'correctionsSkipped']) delete legacy.workerProbe[field];
  const summary = aggregateRewriteSummaries([worker(0), legacy], { shardCount: 2 });
  assert.equal(summary.readiness.checks, 8);
  assert.equal(summary.readiness.generationRequests, null);
  assert.match(formatRewriteReport(summary), /Readiness generation requests \| Not measured/);
});
