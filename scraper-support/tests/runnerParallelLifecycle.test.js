import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/runnerParallelLifecycle.js', import.meta.url))

const runScenario = (scenario, parallel = true) => {
  const child = spawnSync(process.execPath, [fixture, scenario, ...(parallel ? ['--parallel'] : [])], {
    encoding: 'utf8',
    timeout: 15_000,
  })
  assert.equal(child.error, undefined)
  assert.equal(child.status, 0, child.stderr || child.stdout)
  return JSON.parse(child.stdout)
}

test('parallel lifecycle timeout records a source failure and continues the queue', () => {
  const result = runScenario('timeout')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['broken', 'queued'])
  assert.deepEqual(Object.keys(result.history).sort(), ['broken', 'queued'])
  assert.equal(result.history.broken.success, false)
  assert.equal(result.history.broken.failureKind, 'runner_lifecycle_timeout')
  assert.equal(result.history.queued.success, true)
  assert.equal(result.finished.aborted, false)
})

test('quota exhaustion leaves pending work and continues the queue', () => {
  const result = runScenario('quota')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['alpha', 'beta'])
  assert.equal(result.summary.alpha.persistencePending, true)
  assert.deepEqual(Object.keys(result.checkpoint.completed), ['beta'])
})

for (const parallel of [true, false]) {
  for (const scenario of ['transaction', 'connection', 'status-read', 'status-write']) {
    test(`${parallel ? 'parallel' : 'sequential'} ${scenario} failure stays pending while the next source completes`, () => {
      const result = runScenario(scenario, parallel)
      assert.equal(result.error, null)
      assert.equal(result.summary.alpha.persistencePending, true)
      assert.equal(result.summary.alpha.processingComplete, false)
      assert.equal(result.summary.beta.success, true)
      assert.deepEqual(Object.keys(result.checkpoint.completed), ['beta'])
      assert.equal(result.checkpoint.status, 'interrupted')
    })
  }
  test(`${parallel ? 'parallel' : 'sequential'} resume retries only unfinished database work`, () => {
    const result = runScenario('transaction-resume', parallel)
    assert.equal(result.error, null)
    assert.deepEqual(Object.keys(result.firstCheckpoint.completed), ['beta'])
    assert.deepEqual(result.started, ['alpha', 'beta', 'alpha'])
    assert.equal(result.checkpoint.status, 'complete')
    assert.equal(result.checkpoint.completedCount, 2)
  })
  for (const scenario of ['finalization-resume', 'finalization-still-unavailable']) {
    test(`${parallel ? 'parallel' : 'sequential'} ${scenario} retries metadata without repeating completed sources`, () => {
      const result = runScenario(scenario, parallel)
      assert.equal(result.error, null)
      assert.equal(result.firstCheckpoint.persistencePending, true)
      assert.equal(result.firstCheckpoint.status, 'interrupted')
      assert.deepEqual(result.started, ['alpha', 'beta'])
      assert.equal(result.checkpoint.completedCount, 2)
      assert.equal(result.checkpoint.status, scenario === 'finalization-resume' ? 'complete' : 'interrupted')
    })
  }
  for (const scenario of ['code-error', 'source-code-error']) {
    test(`${parallel ? 'parallel' : 'sequential'} ${scenario} remains isolated while the next source completes`, () => {
      const result = runScenario(scenario, parallel)
      assert.equal(result.error, null)
      assert.deepEqual(result.started, ['alpha', 'beta'])
      assert.equal(result.history.alpha.success, false)
      assert.match(result.history.alpha.error, /invalid .* code/)
      assert.equal(result.history.beta.success, true)
      assert.equal(result.finished.aborted, false)
      assert.equal(result.checkpoint.completedCount, 2)
      assert.equal(result.checkpoint.status, 'complete')
    })
  }
}

for (const scenario of ['fatal-cleanup']) {
  test(`lifecycle timeout preserves ${scenario} errors instead of downgrading them to a warning`, () => {
    const result = runScenario(scenario)
    assert.match(result.error?.message || '', /shared persistence failed during abort cleanup/)
    assert.deepEqual(result.started, ['broken'])
    assert.equal(result.finished.aborted, true)
  })
}

test('source cleanup failure after a lifecycle timeout leaves queued work running', () => {
  const result = runScenario('persistence-cleanup')
  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['broken', 'queued'])
  assert.equal(result.history.broken.success, false)
  assert.equal(result.history.broken.failureKind, 'runner_lifecycle_timeout')
  assert.equal(result.history.queued.success, true)
  assert.equal(result.finished.aborted, false)
})

test('parallel timeout stays bounded when a source ignores its abort signal', () => {
  const result = runScenario('uncooperative-timeout')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['broken', 'queued'])
  assert.equal(result.history.broken.failureKind, 'runner_lifecycle_timeout')
  assert.equal(result.history.queued.success, true)
  assert.equal(result.finished.aborted, false)
})

test('parallel summaries preserve individual names for deactivated sources', () => {
  const result = runScenario('inactive')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, [])
  assert.deepEqual(Object.keys(result.history).sort(), ['disabled-one', 'disabled-two'])
  assert.equal(result.history['disabled-one'].skipped, true)
  assert.equal(result.history['disabled-two'].skipped, true)
})

test('cooperative source timeouts allow queued sources to run after recording the failure', () => {
  const result = runScenario('cooperative-timeout')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['broken', 'queued'])
  assert.equal(result.history.broken.success, false)
  assert.equal(result.history.broken.failureKind, 'runner_lifecycle_timeout')
  assert.equal(result.history.queued.success, true)
  assert.equal(result.finished.aborted, false)
})

test('a source that settles six seconds after timeout does not abort the parallel run', () => {
  const result = runScenario('slow-cleanup')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['broken', 'queued'])
  assert.equal(result.history.broken.failureKind, 'runner_lifecycle_timeout')
  assert.equal(result.history.queued.success, true)
  assert.equal(result.finished.aborted, false)
})

test('parallel runner resumes from a per-source checkpoint without rerunning completed work', () => {
  const result = runScenario('checkpoint-resume')

  assert.equal(result.error, null)
  assert.deepEqual(result.started, ['beta'])
  assert.deepEqual(Object.keys(result.history).sort(), ['alpha', 'beta'])
  assert.equal(result.history.alpha.success, true)
  assert.equal(result.history.beta.success, true)
  assert.equal(result.checkpoint.status, 'complete')
  assert.equal(result.checkpoint.completedCount, 2)
})

for (const parallel of [true, false]) {
  test(`${parallel ? 'parallel' : 'sequential'} checkpointed source failures do not stop queued sources even with a legacy abort threshold`, () => {
    const result = runScenario('checkpoint-failure-threshold', parallel)

    assert.equal(result.error, null)
    assert.deepEqual(result.started, ['beta'])
    assert.deepEqual(Object.keys(result.history).sort(), ['alpha', 'beta'])
    assert.equal(result.history.alpha.success, false)
    assert.equal(result.finished.aborted, false)
    assert.equal(result.checkpoint.status, 'complete')
    assert.equal(result.checkpoint.completedCount, 2)
  })
}

for (const parallel of [true, false]) {
  test(`${parallel ? 'parallel' : 'sequential'} runner preserves failed retry telemetry in run history`, () => {
    const result = runScenario('failed-retry-telemetry', parallel)
    assert.equal(result.error, null)
    assert.deepEqual(result.started, ['unavailable', 'unavailable'])
    assert.equal(result.history.unavailable.success, false)
    assert.deepEqual(result.history.unavailable.retry, { attemptsUsed: 2, retries: 1, retryDelayMs: 2000 })
  })
  test(`${parallel ? 'parallel' : 'sequential'} runner retains recovered HTTP retries in persisted run history`, () => {
    const result = runScenario('recovered-request-telemetry', parallel)
    assert.equal(result.error, null)
    assert.equal(result.httpRequests, 2)
    assert.equal(result.history.recovered.success, true)
    assert.deepEqual(result.history.recovered.retry, { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
    assert.deepEqual(result.history.recovered.retryPressure, {
      nestedScopes: 1, nestedAttempts: 2, nestedRetries: 1, nestedFailedAttempts: 1,
      nestedRetryDelayMs: 0, httpStatusCounts: { 429: 1 },
    })
  })
}


test('a timed-out source and subsequent source are both checkpointed', () => {
  const result = runScenario('checkpoint-timeout')
  assert.equal(result.error, null)
  assert.deepEqual(Object.keys(result.checkpoint.completed).sort(), ['broken', 'queued'])
  assert.equal(result.checkpoint.completed.broken.result.failureKind, 'runner_lifecycle_timeout')
  assert.equal(result.checkpoint.completedCount, 2)
  assert.equal(result.checkpoint.remainingCount, 0)
  assert.equal(result.checkpoint.status, 'complete')
})
test('shutdown cancels active classification and preserves the source for checkpoint retry', () => {
  const result = runScenario('shutdown-classification')
  assert.equal(result.peerAborted, true)
  assert.equal(result.peerSettled, true)
  assert.deepEqual(result.started, ['peer'])
  assert.equal(result.checkpoint.completedCount, 0)
  assert.equal(result.checkpoint.status, 'interrupted')
})

test('a failed required model scan stays pending while another source can finish', () => {
  const result = runScenario('classification-pending')
  assert.equal(result.history.alpha.classificationPending, true)
  assert.equal(result.history.beta.success, true)
  assert.deepEqual(Object.keys(result.checkpoint.completed), ['beta'])
  assert.equal(result.checkpoint.status, 'interrupted')
})
