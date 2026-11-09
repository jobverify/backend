import assert from 'node:assert/strict'
import test from 'node:test'
import * as worker from '../scripts/catalogExtractionWorker.js'

const provider = { source: 'fixture' }
const metrics = (jobs, evidence) => worker.extractionRawJobMetrics(provider, jobs, evidence)
const nativeJobs = (count, extracted = 2) => [{ nativeCollectionEvidence: { source: 'fixture', observedListingCount: count } }, ...Array.from({ length: extracted - 1 }, () => ({}))]

test('native observed rows are separate from the extracted subset and unknown advertised total', () => {
  assert.deepEqual(metrics(nativeJobs(46, 10), { reportedTotal: null }), { rawJobs: 46, rawJobsBasis: 'observed-native-listing-rows' })
})

test('a declared inventory total keeps its existing priority and explicit basis', () => {
  assert.deepEqual(metrics(nativeJobs(82, 79), { reportedTotal: 82 }), { rawJobs: 82, rawJobsBasis: 'inventory-reported-total' })
  assert.deepEqual(metrics([], { reportedTotal: 0 }), { rawJobs: 0, rawJobsBasis: 'inventory-reported-total' })
})

test('missing counts keep compatible extraction fallback semantics without claiming inventory completeness', () => {
  assert.deepEqual(metrics([{}, {}], null), { rawJobs: 2, rawJobsBasis: 'extracted-jobs-fallback' })
  assert.deepEqual(metrics([], null), { rawJobs: 0, rawJobsBasis: 'extracted-jobs-fallback' })
})

test('foreign-source native evidence and accessors cannot establish a source count', () => {
  assert.deepEqual(metrics([{ nativeCollectionEvidence: { source: 'another-company', observedListingCount: 7 } }], null), { rawJobs: 1, rawJobsBasis: 'extracted-jobs-fallback' })
  const first = {}; Object.defineProperty(first, 'nativeCollectionEvidence', { get() { throw Error('must not execute getter') } })
  assert.deepEqual(metrics([first], null), { rawJobs: 1, rawJobsBasis: 'extracted-jobs-fallback' })
})

test('inconsistent native counts remain explicit and invalid values never become verified zero', () => {
  assert.deepEqual(metrics(nativeJobs(1), null), { rawJobs: 2, rawJobsBasis: 'extracted-jobs-fallback', rawJobsCountConflict: true })
  for (const count of [null, undefined, -1, NaN, Infinity, 1.5, 1000001, '7']) assert.deepEqual(metrics(nativeJobs(count), null), { rawJobs: 2, rawJobsBasis: 'extracted-jobs-fallback' })
})
