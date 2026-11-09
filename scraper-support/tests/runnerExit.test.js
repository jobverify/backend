import assert from 'node:assert/strict'
import test from 'node:test'

import {
  finalizeDirectRunnerExit,
  formatParallelProgressLog,
  refreshVisibleDatasetSummaryWithLogging,
} from '../runner.js'

test('parallel progress log converts its timestamp to IST', () => {
  const timestamp = new Date('2026-08-08T13:24:52.341Z')

  assert.equal(
    formatParallelProgressLog(140, 4833, timestamp),
    '[2026-08-08 -- 18:54:52.341 IST] [runner] Progress: 140/4833 scrapers finished.',
  )
})

test('finalizeDirectRunnerExit forces a clean zero exit when no failure was recorded', () => {
  let capturedCode = null

  finalizeDirectRunnerExit({
    processRef: { exitCode: undefined },
    exit: (code) => {
      capturedCode = code
    },
  })

  assert.equal(capturedCode, 0)
})

test('finalizeDirectRunnerExit uses the process exit function by default', () => {
  let capturedCode = null

  finalizeDirectRunnerExit({
    processRef: {
      exitCode: undefined,
      exit: (code) => {
        capturedCode = code
      },
    },
  })

  assert.equal(capturedCode, 0)
})

test('finalizeDirectRunnerExit preserves a non-zero exit code', () => {
  let capturedCode = null

  finalizeDirectRunnerExit({
    processRef: { exitCode: 1 },
    exit: (code) => {
      capturedCode = code
    },
  })

  assert.equal(capturedCode, 1)
})

test('refreshVisibleDatasetSummaryWithLogging emits finalizer stage boundaries', async () => {
  const stages = []

  await refreshVisibleDatasetSummaryWithLogging({
    refresh: async () => {},
    logStage: (event) => stages.push(`${event.stage}:${event.status}`),
  })

  assert.deepEqual(stages, [
    'dataset summary:start',
    'dataset summary:done',
  ])
})
