import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { openRunCheckpoint, renameFileWithRetry } from '../utils/runCheckpoint.js'

const createTempCheckpoint = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-checkpoint-'))
  return {
    directory,
    filePath: path.join(directory, 'run-state.json'),
  }
}

test('terminal partial extraction survives resume without being rerun or losing processing outcome', t => {
  const { directory, filePath } = createTempCheckpoint()
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const options = { filePath, sources: ['partial', 'blocked', 'pending'], mode: 'live', parallel: true, runId: 'partial-run' }
  const first = openRunCheckpoint(options)
  first.markSourceCompleted('partial', { success: true, partial: true, processingComplete: true, jobs: 2, inserted: 1, updated: 1 })
  first.markSourceCompleted('blocked', { success: false, softFailure: true, failureKind: 'coverage_gap', processingComplete: true, zeroJobEvidence: 'blocked-zero' })
  const resumed = openRunCheckpoint(options)
  assert.deepEqual(resumed.pendingSources(options.sources), ['pending'])
  assert.deepEqual(resumed.completedSummary().partial, { success: true, partial: true, processingComplete: true, jobs: 2, inserted: 1, updated: 1 })
  assert.equal(resumed.completedSummary().blocked.processingComplete, true)
})

test('run checkpoint resumes only unfinished sources and preserves prior results', () => {
  const { directory, filePath } = createTempCheckpoint()
  const sources = ['alpha', 'beta', 'gamma']

  try {
    const first = openRunCheckpoint({
      filePath,
      sources,
      mode: 'live',
      parallel: true,
      runId: 'run-one',
      now: () => new Date('2026-09-12T06:00:00.000Z'),
    })
    first.markSourceStarted('alpha')
    first.markSourceCompleted('alpha', { success: true, jobs: 3, inserted: 2, filteredEmptyDescription: 1 })

    const resumed = openRunCheckpoint({
      filePath,
      sources,
      mode: 'live',
      parallel: true,
      runId: 'run-one',
      now: () => new Date('2026-09-12T06:05:00.000Z'),
    })

    assert.deepEqual(resumed.pendingSources(sources), ['beta', 'gamma'])
    assert.deepEqual(resumed.completedSummary(), {
      alpha: { success: true, jobs: 3, inserted: 2, filteredEmptyDescription: 1 },
    })
    assert.equal(resumed.snapshot().inProgress.alpha, undefined)
    assert.equal(resumed.snapshot().completedCount, 1)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run checkpoint writes valid state atomically and marks incomplete shutdowns', () => {
  const { directory, filePath } = createTempCheckpoint()

  try {
    const checkpoint = openRunCheckpoint({
      filePath,
      sources: ['alpha', 'beta'],
      mode: 'live',
      parallel: true,
      runId: 'run-two',
    })
    checkpoint.markSourceStarted('alpha')
    checkpoint.markSourceCompleted('alpha', { success: false, failureKind: 'http_503' })
    checkpoint.finish({ interruptedBy: 'SIGTERM' })

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    assert.equal(saved.status, 'interrupted')
    assert.equal(saved.interruptedBy, 'SIGTERM')
    assert.equal(saved.completedCount, 1)
    assert.equal(saved.remainingCount, 1)
    assert.deepEqual(
      fs.readdirSync(directory).filter((name) => name.includes('.tmp')),
      [],
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run checkpoint rejects a catalog change inside the same run directory', () => {
  const { directory, filePath } = createTempCheckpoint()

  try {
    openRunCheckpoint({
      filePath,
      sources: ['alpha', 'beta'],
      mode: 'live',
      parallel: true,
      runId: 'run-three',
    })

    assert.throws(
      () => openRunCheckpoint({
        filePath,
        sources: ['alpha', 'gamma'],
        mode: 'live',
        parallel: true,
        runId: 'run-three',
      }),
      /catalog changed/i,
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run checkpoint can resume after an already completed source leaves the catalog', () => {
  const { directory, filePath } = createTempCheckpoint()
  try {
    const initial = openRunCheckpoint({ filePath, sources: ['alpha', 'beta', 'gamma'], mode: 'dry-run', parallel: true })
    initial.markSourceCompleted('beta', { success: true, jobs: 4 })

    const resumed = openRunCheckpoint({ filePath, sources: ['alpha', 'gamma'], mode: 'dry-run', parallel: true })
    assert.deepEqual(resumed.pendingSources(['alpha', 'gamma']), ['alpha', 'gamma'])
    assert.deepEqual(resumed.snapshot().catalogSources, ['alpha', 'beta', 'gamma'])
    resumed.markSourceCompleted('alpha', { success: true, jobs: 1 })
    resumed.markSourceCompleted('gamma', { success: true, jobs: 2 })
    resumed.finish()
    assert.equal(resumed.snapshot().completedCount, 3)
    assert.equal(resumed.snapshot().remainingCount, 0)
    assert.equal(resumed.snapshot().status, 'complete')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run checkpoint still rejects removal of an unfinished source', () => {
  const { directory, filePath } = createTempCheckpoint()
  try {
    const initial = openRunCheckpoint({ filePath, sources: ['alpha', 'beta'], mode: 'dry-run', parallel: true })
    initial.markSourceCompleted('alpha', { success: true })
    assert.throws(() => openRunCheckpoint({ filePath, sources: ['alpha'], mode: 'dry-run', parallel: true }), /catalog changed/i)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run checkpoint keeps summary metrics but omits bulky per-source detail', () => {
  const { directory, filePath } = createTempCheckpoint()

  try {
    const checkpoint = openRunCheckpoint({
      filePath,
      sources: ['alpha'],
      mode: 'live',
      parallel: true,
      runId: 'run-four',
    })
    checkpoint.markSourceCompleted('alpha', {
      success: true,
      jobs: 5,
      inserted: 2,
      cities: Array.from({ length: 500 }, (_, index) => `City ${index}`),
      dataQuality: { missingTitle: 0, missingLocation: 1, missingApplyUrl: 0 },
      retry: { attemptsUsed: 2, retries: 1, retryDelayMs: 2000 },
    })

    assert.deepEqual(checkpoint.completedSummary().alpha, {
      success: true,
      jobs: 5,
      inserted: 2,
      dataQuality: { missingTitle: 0, missingLocation: 1, missingApplyUrl: 0 },
      retry: { attemptsUsed: 2, retries: 1, retryDelayMs: 2000 },
    })
    assert.ok(fs.statSync(filePath).size < 2_000)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('checkpoint replacement retries transient Windows file-lock errors', () => {
  const attempts = []
  const delays = []

  renameFileWithRetry('run-state.tmp', 'run-state.json', {
    rename: (sourcePath, destinationPath) => {
      attempts.push([sourcePath, destinationPath])
      if (attempts.length < 3) {
        const error = new Error('operation not permitted')
        error.code = 'EPERM'
        throw error
      }
    },
    wait: (milliseconds) => delays.push(milliseconds),
    retryDelayMs: 25,
    maxAttempts: 4,
  })

  assert.deepEqual(attempts, [
    ['run-state.tmp', 'run-state.json'],
    ['run-state.tmp', 'run-state.json'],
    ['run-state.tmp', 'run-state.json'],
  ])
  assert.deepEqual(delays, [25, 50])
})
