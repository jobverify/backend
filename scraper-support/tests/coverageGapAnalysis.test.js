import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  bucketFailure,
  bucketPipelineFailure,
  bucketSoftFailure,
  collectFailureContinuation,
  parsePipelineRowsFromLogGroups,
} from '../../scripts/analyzeCoverageJobGaps.js'

const runnerFixture = fileURLToPath(new URL('./fixtures/runnerWarningPolicy.js', import.meta.url))
for (const parallel of [false, true]) {
  for (const { scenario, status, jobs, category } of [
    { scenario: 'blocked-zero', status: 'Unavailable', jobs: 0, category: 'pipeline_inventory_unavailable' },
    { scenario: 'unverified-zero', status: 'Unavailable', jobs: 0, category: 'pipeline_inventory_unavailable' },
    { scenario: 'incomplete-details', status: 'Partial', jobs: 1, category: 'pipeline_partial_extraction' },
    { scenario: 'complete-inventory', status: 'OK', jobs: 1 },
  ]) {
    test(`coverage parser retains ${scenario} from actual ${parallel ? 'parallel' : 'sequential'} runner output`, t => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-completion-log-'))
      t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
      const child = spawnSync(process.execPath, [runnerFixture, scenario, directory, '--dry-run', ...(parallel ? ['--parallel'] : [])], {
        encoding: 'utf8', timeout: 15_000,
      })
      assert.equal(child.error, undefined)
      assert.equal(child.status, 0, child.stdout + child.stderr)
      const { latestBySource } = parsePipelineRowsFromLogGroups([{ text: child.stdout }])
      const result = latestBySource.get('broken')
      assert.equal(result?.status, status)
      assert.equal(result.jobs, jobs)
      assert.ok(result.detail.endsWith(path.join(directory, 'broken.json')))
      if (category) assert.equal(bucketPipelineFailure(result), category)
    })
  }
}

test('coverage parsing recognizes explicit completion labels and ignores arbitrary status prefixes', () => {
  const { latestBySource } = parsePipelineRowsFromLogGroups([{ text: [
    '  OK [ascii] 1 India jobs | +1 fresh',
    '  ✓ [tick] 2 India jobs | +2 fresh',
    '  ✔ [heavy-tick] 3 India jobs | +3 fresh',
    '  [unprefixed] 4 India jobs | +4 fresh',
    '  DEBUG [unknown] 9 India jobs | telemetry only',
    '  FAILED [not-success] 8 India jobs | diagnostic only',
  ].join('\n') }])
  assert.deepEqual([...latestBySource.values()].map(({ source, status, jobs }) => ({ source, status, jobs })), [
    { source: 'ascii', status: 'OK', jobs: 1 },
    { source: 'tick', status: 'OK', jobs: 2 },
    { source: 'heavy-tick', status: 'OK', jobs: 3 },
    { source: 'unprefixed', status: 'OK', jobs: 4 },
  ])
})

test('failure continuations stop at new completion labels and current failure records', () => {
  for (const boundary of [
    '  UNAVAILABLE [next] 0 India jobs -> next.json',
    '  PARTIAL [next] 2 India jobs | +1 fresh',
    '  OK [next] 2 India jobs | +1 fresh',
    '  ✓ [next] 2 India jobs | +1 fresh',
    '  WARN [next] UPSTREAM: fetch failed',
    '  WARN [next] SOURCE FAILED: invalid records',
    '[2/4] Starting [next]...',
  ]) {
    assert.equal(collectFailureContinuation(['  ✗ [first] FAILED: parser error', '  first record detail', boundary], 0),
      ' first record detail', boundary)
  }
})

test('legacy and current failure formats retain multiline errors without swallowing completion records', () => {
  const { latestBySource } = parsePipelineRowsFromLogGroups([{ text: [
    '  ⚠ [upstream] UPSTREAM: fetch failed',
    '  upstream detail',
    '  UNAVAILABLE [unavailable] 0 India jobs -> unavailable.json',
    '  ✗ [failed] FAILED: invalid result',
    '  legacy detail',
    '  PARTIAL [partial] 1 India jobs | +1 fresh',
    '  WARN [current] SOURCE FAILED: malformed records',
    '  current detail',
    '  OK [healthy] 2 India jobs | +2 fresh',
  ].join('\n') }])
  assert.equal(latestBySource.get('upstream')?.status, 'Upstream')
  assert.equal(latestBySource.get('upstream')?.error, 'fetch failed upstream detail')
  assert.equal(latestBySource.get('failed')?.status, 'Fail')
  assert.equal(latestBySource.get('failed')?.error, 'invalid result legacy detail')
  assert.equal(latestBySource.get('current')?.status, 'Fail')
  assert.equal(latestBySource.get('current')?.error, 'malformed records current detail')
  assert.equal(latestBySource.get('unavailable')?.status, 'Unavailable')
  assert.equal(latestBySource.get('partial')?.status, 'Partial')
  assert.equal(latestBySource.get('healthy')?.status, 'OK')
})

test('incomplete extraction categories stay separate from successful or failed upstream checks', () => {
  assert.equal(bucketPipelineFailure({ status: 'Partial', jobs: 1 }), 'pipeline_partial_extraction')
  assert.equal(bucketPipelineFailure({ status: 'Unavailable', jobs: 0 }), 'pipeline_inventory_unavailable')
})

test('collectFailureContinuation stops before persistence warnings from other workers', () => {
  const lines = [
    '  ✗ [dineshchandraragrawalinfracon] FAILED: fetch failed',
    '  ✗ [directshifts] Failed to save status to DB: connect ETIMEDOUT 159.41.206.100:27017',
    '  ✗ [683/3158] [discord] Failed to verify active status from DB: connect ETIMEDOUT 159.41.206.100:27017',
  ]

  assert.equal(collectFailureContinuation(lines, 0), '')
})

test('parsePipelineRowsFromLogGroups recognizes upstream soft-failure lines', () => {
  const { latestBySource } = parsePipelineRowsFromLogGroups([
    {
      runOrder: 1,
      logName: 'pipeline.out.log',
      text: [
        '▶ [1/2] Starting [blinkit]...',
        '  ⚠ [blinkit] UPSTREAM: Blinkit official careers page is access denied by the upstream site',
      ].join('\n'),
    },
  ])

  assert.deepEqual(latestBySource.get('blinkit'), {
    source: 'blinkit',
    status: 'Upstream',
    jobs: 0,
    error: 'Blinkit official careers page is access denied by the upstream site',
    runOrder: 1,
    logName: 'pipeline.out.log',
  })
})

test('bucketFailure keeps parser errors hard but buckets expected external failures separately', () => {
  assert.equal(
    bucketFailure('Verified first-party surface changed materially'),
    'failed_surface_drift_or_fail_closed',
  )
  assert.equal(
    bucketFailure('HTTP 307 for https://www.winjit.com/'),
    'failed_surface_drift_or_fail_closed',
  )
  assert.equal(
    bucketFailure('Aress official careers page exposes no structured public job cards'),
    'failed_surface_drift_or_fail_closed',
  )
  assert.equal(
    bucketFailure('Unable to find Cornerstone OnDemand CSOD context in career page HTML'),
    'failed_surface_drift_or_fail_closed',
  )
  assert.equal(
    bucketFailure('Qbss first-party careers surface is now publicly enumerable and needs a structured scraper'),
    'failed_surface_drift_or_fail_closed',
  )
  assert.equal(
    bucketFailure('HTTP 403 for https://example.com/careers'),
    'failed_blocked_or_access_denied',
  )
  assert.equal(
    bucketFailure('Workday jobs API returned HTTP_500 at https://example.com/jobs'),
    'failed_network_or_timeout',
  )
  assert.equal(
    bucketFailure('Cannot read properties of undefined'),
    'failed_parser_or_contract_error',
  )
})

test('bucketSoftFailure reports external failures without failed prefixes', () => {
  assert.equal(
    bucketSoftFailure('HTTP 403 for https://example.com/careers'),
    'pipeline_soft_blocked_or_access_denied',
  )
  assert.equal(
    bucketSoftFailure('fetch failed'),
    'pipeline_soft_network_or_timeout',
  )
  assert.equal(
    bucketSoftFailure('Verified first-party surface changed materially'),
    'pipeline_soft_surface_drift_or_fail_closed',
  )
})

test('bucketPipelineFailure applies soft policy to legacy failed external rows', () => {
  assert.equal(
    bucketPipelineFailure({
      status: 'Fail',
      error: 'HTTP 403 for https://example.com/careers',
    }),
    'pipeline_soft_blocked_or_access_denied',
  )

  assert.equal(
    bucketPipelineFailure({
      status: 'Fail',
      error: 'Cannot read properties of undefined',
    }),
    'failed_parser_or_contract_error',
  )

  assert.equal(
    bucketPipelineFailure({
      status: 'Upstream',
      error: 'fetch failed',
    }),
    'pipeline_soft_network_or_timeout',
  )
})
