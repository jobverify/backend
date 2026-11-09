import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FALLBACK_PARALLEL_SCRAPER_CONCURRENCY,
  resolveConfiguredParallelScraperConcurrency,
  resolveParallelWorkerConcurrency,
} from '../scraper-support/utils/parallelConcurrency.js'

test('dry runs preserve requested parallelism without extra local clamping', () => {
  assert.deepEqual(
    resolveParallelWorkerConcurrency({
      requested: '10',
      dryRun: true,
    }),
    {
      requested: 10,
      effective: 10,
      clamped: false,
    },
  )
})

test('live runs preserve requested parallelism', () => {
  assert.deepEqual(
    resolveParallelWorkerConcurrency({
      requested: '10',
      dryRun: false,
    }),
    {
      requested: 10,
      effective: 10,
      clamped: false,
    },
  )
})

test('dry runs keep requested parallelism when it is already within the safe range', () => {
  assert.deepEqual(
    resolveParallelWorkerConcurrency({
      requested: '2',
      dryRun: true,
    }),
    {
      requested: 2,
      effective: 2,
      clamped: false,
    },
  )
})


test('invalid requested values fall back to the configured concurrency', () => {
  assert.deepEqual(
    resolveParallelWorkerConcurrency({
      requested: 'invalid',
      dryRun: true,
      defaultConcurrency: 5,
    }),
    {
      requested: 5,
      effective: 5,
      clamped: false,
    },
  )
})

test('configured concurrency prefers the .env SCRAPER_CONCURRENCY value', () => {
  assert.equal(resolveConfiguredParallelScraperConcurrency('5'), 5)
})

test('configured concurrency falls back to the minimum worker pool size when unset', () => {
  assert.equal(
    resolveConfiguredParallelScraperConcurrency('', FALLBACK_PARALLEL_SCRAPER_CONCURRENCY),
    FALLBACK_PARALLEL_SCRAPER_CONCURRENCY,
  )
})
