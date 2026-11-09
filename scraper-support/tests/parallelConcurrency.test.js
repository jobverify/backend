import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveParallelWorkerConcurrency,
} from '../utils/parallelConcurrency.js'

test('resolveParallelWorkerConcurrency keeps the requested dry-run concurrency', () => {
  assert.deepEqual(
    resolveParallelWorkerConcurrency({
      requested: '5',
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
