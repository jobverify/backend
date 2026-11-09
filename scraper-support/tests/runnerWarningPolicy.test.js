import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { stageOutcome } from '../../src/pipeline/policy.js'

const fixture = fileURLToPath(new URL('./fixtures/runnerWarningPolicy.js', import.meta.url))
function runScenario(t, scenario, parallel, { dryRun = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scraper-warning-policy-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const child = spawnSync(process.execPath, [fixture, scenario, directory, ...(parallel ? ['--parallel'] : []), ...(dryRun ? ['--dry-run'] : [])], {
    encoding: 'utf8', timeout: 15_000,
  })
  assert.equal(child.error, undefined)
  const summaryPath = path.join(directory, 'summary.json')
  return { ...child, directory, state: JSON.parse(fs.readFileSync(path.join(directory, 'state.json'), 'utf8')),
    summary: fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null }
}
for (const parallel of [false, true]) {
  const mode = parallel ? 'parallel' : 'sequential'
  for (const dryRun of [false, true]) {
    for (const { scenario, label, jobs } of [
      { scenario: 'blocked-zero', label: 'UNAVAILABLE', jobs: 0 },
      { scenario: 'unverified-zero', label: 'UNAVAILABLE', jobs: 0 },
      { scenario: 'incomplete-details', label: 'PARTIAL', jobs: 1 },
      { scenario: 'complete-inventory', label: 'OK', jobs: 1 },
    ]) {
      test(`${mode} ${dryRun ? 'dry' : 'live'} CLI logs normalized completion for ${scenario}`, t => {
        const result = runScenario(t, scenario, parallel, { dryRun })
        assert.equal(result.status, 0, result.stdout + result.stderr)
        const lines = result.stdout.split(/\r?\n/).filter(line => line.includes('[broken]') && line.includes('India jobs'))
        assert.equal(lines.length, 1)
        if (label === 'OK') assert.match(lines[0], /^  (?:OK|✓) \[broken\] 1 India jobs/u)
        else assert.ok(lines[0].startsWith(`  ${label} [broken] ${jobs} India jobs`), lines[0])
        if (label !== 'OK') assert.doesNotMatch(lines[0], /\bOK\b|✓/u)
        if (dryRun) {
          const file = path.join(result.directory, 'broken.json')
          assert.ok(lines[0].endsWith(` -> ${file}`), lines[0])
          assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, jobs)
        } else {
          assert.match(lines[0], /\+1 fresh/)
          assert.match(lines[0], /~2 updated/)
        }
        assert.ok(result.state.saved.includes('broken'))
      })
    }
  }
  for (const scenario of ['blocked-zero', 'unverified-zero']) {
    test(`${mode} CLI reports ${scenario} as unavailable extraction after completing processing`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      const source = result.state.history.broken
      assert.equal(source.success, false)
      assert.equal(source.softFailure, true)
      assert.equal(source.failureKind, 'coverage_gap')
      assert.equal(source.zeroJobEvidence, scenario)
      assert.equal(source.processingComplete, true)
      assert.equal(result.summary.taskOutcomes.succeeded, 1)
      assert.deepEqual(result.summary.extractionChecks, { complete: 1, incomplete: 1 })
      assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
      assert.match(result.stdout, /Coverage gaps\s+\| 1/)
    })
  }
  for (const scenario of ['incomplete-details', 'missing-evidence', 'incomplete-inventory', 'stale-evidence']) {
    test(`${mode} CLI retains saved ${scenario} jobs as a terminal partial extraction`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      const source = result.state.history.broken
      assert.equal(source.success, true)
      assert.equal(source.partial, true)
      assert.equal(source.processingComplete, true)
      assert.equal(source.jobs, 1)
      assert.equal(source.inserted, 1)
      assert.equal(source.updated, 2)
      assert.equal(result.state.persistenceOptions.broken.replaceExisting, false)
      assert.equal(result.summary.inserted, 2)
      assert.equal(result.summary.updated, 4)
      assert.deepEqual(result.summary.extractionChecks, { complete: 1, incomplete: 1 })
      assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
    })
  }
  test(`${mode} CLI permits cleanup only after complete current listing and details`, t => {
    const result = runScenario(t, 'complete-inventory', parallel)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(result.state.history.broken.success, true)
    assert.notEqual(result.state.history.broken.partial, true)
    assert.equal(result.state.history.broken.jobs, 1)
    assert.notEqual(result.state.persistenceOptions.broken.replaceExisting, false)
    assert.deepEqual(result.summary.extractionChecks, { complete: 2, incomplete: 0 })
  })
  test(`${mode} CLI keeps current verified empty inventories complete`, t => {
    const result = runScenario(t, 'verified-empty', parallel)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(result.state.history.broken.success, true)
    assert.equal(result.state.history.broken.processingComplete, true)
    assert.equal(result.state.persistenceOptions.broken.authoritativeEmpty, true)
    assert.notEqual(result.state.persistenceOptions.broken.replaceExisting, false)
    assert.deepEqual(result.summary.extractionChecks, { complete: 2, incomplete: 0 })
  })
  test(`${mode} CLI reports deactivated sources as skipped rather than successful extractions`, t => {
    const result = runScenario(t, 'inactive', parallel)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(result.summary.skipped, 1)
    assert.equal(result.summary.taskOutcomes.succeeded, 1)
    assert.deepEqual(result.summary.extractionChecks, { complete: 1, incomplete: 1 })
    assert.match(result.stdout, /Skipped\s+\| 1/)
  })
  test(`${mode} CLI warns for a failed source, saves the next source, and completes the scraper stage`, t => {
    const result = runScenario(t, 'source-failure', parallel)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(result.state.started, ['broken', 'healthy'])
    assert.deepEqual(result.state.saved, ['healthy'])
    assert.equal(result.state.history.broken.success, false)
    assert.equal(result.state.finished.aborted, false)
    assert.equal(result.summary.failed, 1)
    assert.equal(result.summary.warnings, 1)
    assert.match(result.stderr, /WARN \[broken\].*source inventory contract failed/)
    assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
  })
  test(`${mode} CLI completes with warnings even when every source fails`, t => {
    const result = runScenario(t, 'all-fail', parallel)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(result.state.started, ['broken', 'healthy'])
    assert.deepEqual(result.state.saved, [])
    assert.equal(result.summary.failed, 2)
    assert.equal(result.summary.warnings, 2)
    assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
  })
  test(`${mode} CLI keeps unfinished persistence blocking the next stage`, t => {
    const result = runScenario(t, 'pending', parallel)
    assert.equal(result.status, 0)
    assert.equal(result.summary.pendingEstimate, 1)
    assert.equal(stageOutcome('scraper', result.summary, result.status), 'incomplete')
  })
  test(`${mode} CLI isolates provider DNS errors without inventing pending database work`, t => {
    const result = runScenario(t, 'source-network-error', parallel)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(result.summary.pendingEstimate, 0)
    assert.equal(result.state.history.broken.upstreamOutage, true)
    assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
  })
  for (const scenario of ['transaction-error', 'quota-error', 'database-seed-error', 'database-active-status-error', 'database-status-write-error']) {
    test(`${mode} CLI reports ${scenario} as resumable incomplete work without failing execution`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.ok(result.summary.pendingEstimate > 0)
      assert.equal(stageOutcome('scraper', result.summary, result.status), 'incomplete')
      const checkpoint = JSON.parse(fs.readFileSync(path.join(result.directory, 'run-state.json'), 'utf8'))
      assert.equal(checkpoint.status, 'interrupted')
      if (!scenario.startsWith('database-seed')) assert.ok(result.state.started.includes('healthy'))
    })
  }
  test(`${mode} CLI retains pending finalization when run-history metadata cannot be persisted`, t => {
    const result = runScenario(t, 'database-finish-error', parallel)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(result.summary.pendingEstimate, 1)
    assert.equal(stageOutcome('scraper', result.summary, result.status), 'incomplete')
    const checkpoint = JSON.parse(fs.readFileSync(path.join(result.directory, 'run-state.json'), 'utf8'))
    assert.equal(checkpoint.completedCount, 2)
    assert.equal(checkpoint.status, 'interrupted')
    assert.equal(checkpoint.persistencePending, true)
  })
  test(`${mode} CLI treats a source's invalid return shape as an isolated warning`, t => {
    const result = runScenario(t, 'invalid-inventory', parallel)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(result.state.saved, ['healthy'])
    assert.equal(result.summary.warnings, 1)
  })
  for (const scenario of ['null-row', 'scalar-row', 'array-row']) {
    test(`${mode} CLI keeps malformed source records (${scenario}) isolated`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(result.state.saved, ['healthy'])
      assert.equal(result.summary.warnings, 1)
      assert.match(result.stderr, /WARN \[broken\]/)
    })
  }
  for (const scenario of ['malformed-description', 'source-code-error', 'processing-code-error', 'fatal-source']) {
    test(`${mode} CLI isolates ${scenario}, checkpoints the failure and completes the next source`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.deepEqual(result.state.started, ['broken', 'healthy'])
      assert.deepEqual(result.state.saved, ['healthy'])
      assert.equal(result.state.statuses.broken.success, false)
      assert.equal(result.state.history.broken.success, false)
      assert.equal(result.state.history.healthy.success, true)
      assert.equal(result.state.finished.aborted, false)
      assert.equal(result.summary.failed, 1)
      assert.equal(result.summary.warnings, 1)
      assert.equal(result.summary.pendingEstimate, 0)
      assert.equal(result.summary.interrupted, false)
      assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
      const checkpoint = JSON.parse(fs.readFileSync(path.join(result.directory, 'run-state.json'), 'utf8'))
      assert.equal(checkpoint.status, 'complete')
      assert.equal(checkpoint.remainingCount, 0)
      assert.equal(checkpoint.completed.broken.result.success, false)
      assert.equal(checkpoint.completed.healthy.result.success, true)
      if (scenario === 'malformed-description') {
        assert.match(result.state.history.broken.error, /Active native content: Unterminated native tag/)
        assert.match(result.state.statuses.broken.error, /Active native content: Unterminated native tag/)
        assert.deepEqual(result.summary.extractionChecks, { complete: 1, incomplete: 1 })
      }
    })
  }
  for (const scenario of ['all-description-fail', 'persistence-error', 'analysis-error']) {
    test(`${mode} CLI completes with warnings when every source has ${scenario}`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.deepEqual(result.state.started, ['broken', 'healthy'])
      assert.deepEqual(result.state.saved, [])
      assert.equal(result.summary.failed, 2)
      assert.equal(result.summary.warnings, 2)
      assert.equal(result.summary.pendingEstimate, 0)
      assert.equal(result.summary.interrupted, false)
      assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
    })
  }
  if (parallel) {
    test('parallel description failure preserves active healthy work and starts queued sources', t => {
      const result = runScenario(t, 'concurrent-description-error', true)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.deepEqual(result.state.started, ['broken', 'peer', 'healthy'])
      assert.deepEqual(result.state.saved.sort(), ['healthy', 'peer'])
      assert.equal(result.state.peerAborted, false)
      assert.equal(result.state.history.broken.success, false)
      assert.equal(result.state.history.peer.success, true)
      assert.equal(result.state.history.healthy.success, true)
      assert.equal(result.summary.failed, 1)
      assert.equal(result.summary.completed, 2)
      assert.equal(result.summary.pendingEstimate, 0)
      assert.equal(stageOutcome('scraper', result.summary, result.status), 'completed')
    })
  }
  for (const scenario of ['runner-code-error', 'artifact-error']) {
    test(`${mode} CLI fails for ${scenario} instead of treating it as a source warning`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 1, result.stdout + result.stderr)
      assert.ok(!result.state.started.includes('healthy'))
      assert.equal(stageOutcome('scraper', result.summary || {}, result.status), 'failed')
    })
  }
  for (const scenario of ['seed-error', 'pipeline-start-error', 'active-status-error', 'status-write-error', 'finish-error']) {
    test(`${mode} CLI fails for shared-boundary ${scenario}`, t => {
      const result = runScenario(t, scenario, parallel)
      assert.equal(result.status, 1, result.stdout + result.stderr)
      assert.match(result.stderr, new RegExp(`shared ${scenario}`))
      assert.equal(stageOutcome('scraper', result.summary || {}, result.status), 'failed')
      if (scenario !== 'finish-error') assert.ok(!result.state.started.includes('healthy'))
    })
  }
}
