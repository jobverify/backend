import test from 'node:test'
import assert from 'node:assert/strict'
import { classificationSkipReason, createClassificationReport, recordClassificationInput, recordClassificationDecision,
  recordClassificationInference, aggregateClassificationSummaries } from '../classification/reporting.js'

test('missing and oversized inputs have distinct reasons and use UTF-8 byte sizes', () => {
  assert.equal(classificationSkipReason({ body: '' }, 8), 'missing_description')
  assert.equal(classificationSkipReason({ body: 'é'.repeat(5) }, 8), 'oversized_description')
  assert.equal(classificationSkipReason({ body: 'é'.repeat(4) }, 8), null)
})

test('reports keep resolved eligibility separate from published labels and uncalibrated model comparisons', () => {
  const summary = createClassificationReport({ cpuThreads: 4, availableCpus: 4 })
  recordClassificationInput(summary, { descriptionOrigin: 'rewrite' })
  recordClassificationDecision(summary, { input: { descriptionOrigin: 'rewrite' },
    result: { resolved: { jobType: 'Unspecified' }, status: 'uncertain',
      sourceQualityIssues: ['insufficient_role_description'], comparison: { agreement: false },
      decisions: { jobType: { probability: .97 } } },
    prediction: { modelLabel: 'Full-time Experienced' }, publicJobType: 'Full-time Experienced' })
  assert.equal(summary.resolvedCategories.Unspecified, 1)
  assert.equal(summary.publicCategories['Full-time Experienced'], 1)
  assert.equal(summary.modelCategories['Full-time Experienced'], 1)
  assert.equal(summary.quality.uncertain, 1)
  assert.equal(summary.quality.modelDisagreement, 1)
  assert.equal(summary.quality.sourceQualityIssues.insufficient_role_description, 1)
  assert.equal(summary.descriptionOrigins.rewrite, 1)
})

test('resource measurements report CPU cores used, bounded latency buckets and peak memory', () => {
  const summary = createClassificationReport({ cpuThreads: 4, availableCpus: 4, peakRssBytes: 100 })
  recordClassificationInference(summary, { seconds: 2, cpuSeconds: 6, peakRssBytes: 200, windows: 5 })
  recordClassificationInference(summary, { seconds: 1, cpuSeconds: 2, peakRssBytes: 150, windows: 1 })
  assert.equal(summary.inference.measuredRequests, 2)
  assert.equal(summary.inference.seconds, 3)
  assert.equal(summary.inference.cpuSeconds, 8)
  assert.equal(summary.inference.windows, 6)
  assert.equal(summary.inference.meanSeconds, 1.5)
  assert.equal(summary.inference.averageCpuCoresUsed, 8 / 3)
  assert.equal(summary.resources.peakRssBytes, 200)
  assert.equal(Object.values(summary.inference.latencyBuckets).reduce((a, b) => a + b, 0), 2)
})

test('four copies of a collection scan are reported separately from assigned jobs', () => {
  const assigned = [8297, 8371, 8177, 8147], completed = [8210, 8277, 8076, 8062]
  const parts = assigned.map((count, shard) => ({ shard, shardCount: 4, mode: 'policy', scanned: 32992,
    assigned: count, completed: completed[shard], skipped: count - completed[shard], failed: 0,
    stale: 0, leased: 0, cached: 0, nativeCached: 0, budgetExhausted: false, elapsedSeconds: 9000 + shard }))
  const summary = aggregateClassificationSummaries(parts)
  assert.equal(summary.scanned, 32992)
  assert.equal(summary.assigned, 32992)
  assert.equal(summary.identityScans, 131968)
  assert.equal(summary.completed, 32625)
  assert.equal(summary.skipped, 367)
  assert.equal(summary.scanCountBasis, 'assigned_partitions')
  assert.equal(summary.elapsedSeconds, 9003)
})

test('unavailable CPU measurements are not reported as zero CPU usage', () => {
  const summary = createClassificationReport()
  recordClassificationInference(summary, { seconds: 10, windows: 1 })
  assert.equal(summary.inference.averageCpuCoresUsed, null)
  recordClassificationInference(summary, { seconds: 2, cpuSeconds: 6, windows: 1 })
  assert.equal(summary.inference.seconds, 12)
  assert.equal(summary.inference.cpuMeasuredSeconds, 2)
  assert.equal(summary.inference.averageCpuCoresUsed, 3)
})

test('aggregation merges quality counters and keeps per-runner CPU and memory measurements', () => {
  const parts = [0, 1].map(shard => ({ ...createClassificationReport({ cpuThreads: shard + 2, availableCpus: 4 }),
    shard, shardCount: 2, assigned: 1, completed: 1, scanned: 2, mode: 'policy',
    failed: 0, skipped: 0, stale: 0, leased: 0, cached: 0, nativeCached: 0, elapsedSeconds: 3 }))
  for (const part of parts) {
    recordClassificationInput(part, { descriptionOrigin: 'source' })
    recordClassificationDecision(part, { input: { descriptionOrigin: 'source' },
      result: { resolved: { jobType: 'Intern' }, comparison: { agreement: true } },
      prediction: { modelLabel: 'Intern' }, publicJobType: 'Intern' })
    recordClassificationInference(part, { seconds: 2, cpuSeconds: 4, windows: 1, peakRssBytes: 100 * (part.shard + 1) })
  }
  parts[1].skipReasons.oversized_description = 1
  parts[1].budgetExhausted = true
  const summary = aggregateClassificationSummaries(parts)
  assert.equal(summary.publicCategories.Intern, 2)
  assert.equal(summary.quality.modelAgreement, 2)
  assert.equal(summary.inference.seconds, 4)
  assert.equal(summary.inference.averageCpuCoresUsed, 2)
  assert.equal(summary.resources.peakRssBytes, 200, 'Separate runners do not share a combined process peak')
  assert.deepEqual(summary.workers.map(worker => worker.cpuThreads), [2, 3])
  assert.equal(summary.skipReasons.oversized_description, 1)
  assert.equal(summary.budgetExhausted, true)
})

test('phase timing aggregation sums measured shards and keeps older missing measurements absent', () => {
  const summary = aggregateClassificationSummaries([
    { shard: 0, timingMs: { sourceRead: 100, modelRoundTrip: 400, reporting: 10 } },
    { shard: 1, timingMs: { sourceRead: 200, modelRoundTrip: 600, reporting: 20 } },
    { shard: 2 },
  ])
  assert.deepEqual(summary.timingMs, { sourceRead: 300, modelRoundTrip: 1000, reporting: 30 })
  assert.equal(aggregateClassificationSummaries([{ shard: 0 }]).timingMs?.modelRoundTrip, undefined)
})
