import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..')
const scriptPath = path.join(repoRoot, 'scripts', 'monitorLocalScrapeRun.js')

test('monitorLocalScrapeRun --json-only emits machine-readable JSON even when failures exist', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-local-scrape-run-'))
  const runDir = path.join(tempDir, 'local-scrape-test')
  fs.mkdirSync(runDir, { recursive: true })

  fs.writeFileSync(
    path.join(runDir, 'stdout.log'),
    [
      '[runner] Progress: 58/3646 scrapers finished.',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(runDir, 'stderr.log'),
    [
      '  ✗ [walmart] UPSTREAM: [walmart] All 3 attempts failed. Last error: [walmart] Workday is currently unavailable upstream at https://example.test',
      '',
    ].join('\n'),
  )

  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--json-only',
      '--run-dir',
      runDir,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 0, result.stderr)

  const payload = JSON.parse(result.stdout)
  assert.equal(payload.completed, 58)
  assert.equal(payload.checkpointFailureCount, 1)
  assert.deepEqual(payload.checkpointFailureSources, [
    { source: 'walmart', count: 1 },
  ])
})

test('monitorLocalScrapeRun reads UTF-16LE logs emitted by Windows PowerShell redirection', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-local-scrape-run-utf16-'))
  const runDir = path.join(tempDir, 'local-scrape-test')
  fs.mkdirSync(runDir, { recursive: true })

  const stdoutText = [
    '[runner] Progress: 125/3646 scrapers finished.',
    '',
  ].join('\n')
  const stderrText = [
    '  × [target] FAILED: [target] Unexpected upstream response body.',
    '',
  ].join('\n')

  fs.writeFileSync(
    path.join(runDir, 'stdout.log'),
    Buffer.concat([
      Buffer.from([0xFF, 0xFE]),
      Buffer.from(stdoutText, 'utf16le'),
    ]),
  )
  fs.writeFileSync(
    path.join(runDir, 'stderr.log'),
    Buffer.concat([
      Buffer.from([0xFF, 0xFE]),
      Buffer.from(stderrText, 'utf16le'),
    ]),
  )

  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--json-only',
      '--run-dir',
      runDir,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 0, result.stderr)

  const payload = JSON.parse(result.stdout)
  assert.equal(payload.completed, 125)
  assert.equal(payload.total, 3646)
  assert.equal(payload.currentCheckpointCompleted, 100)
  assert.equal(payload.checkpointReady, true)
  assert.equal(payload.checkpointFailureCount, 1)
  assert.deepEqual(payload.checkpointFailureSources, [
    { source: 'target', count: 1 },
  ])
})

test('monitorLocalScrapeRun persists checkpoint snapshots on poll and acks one saved checkpoint at a time', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-local-scrape-run-ack-'))
  const runDir = path.join(tempDir, 'local-scrape-test')
  const statePath = path.join(runDir, 'monitor-state.json')
  fs.mkdirSync(runDir, { recursive: true })

  const firstStdoutText = [
    '[runner] Progress: 1311/4071 scrapers finished.',
    '',
  ].join('\n')
  const firstStderrText = [
    '  × [kbr] UPSTREAM: [kbr] Example failure.',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(runDir, 'stdout.log'), firstStdoutText)
  fs.writeFileSync(path.join(runDir, 'stderr.log'), firstStderrText)
  fs.writeFileSync(statePath, JSON.stringify({
    acknowledgedCheckpointCompleted: 1200,
    acknowledgedStderrLength: 0,
  }, null, 2))

  const pollResult = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--json-only',
      '--run-dir',
      runDir,
      '--state-file',
      statePath,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  assert.equal(pollResult.status, 0, pollResult.stderr)

  const stateAfterPoll = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  assert.deepEqual(stateAfterPoll.pendingCheckpoints, [
    {
      checkpointCompleted: 1300,
      stderrLength: firstStderrText.length,
    },
  ])

  const secondStdoutText = [
    '[runner] Progress: 1497/4071 scrapers finished.',
    '',
  ].join('\n')
  const secondStderrText = [
    ...firstStderrText.trimEnd().split('\n'),
    '  × [kuvera] UPSTREAM: [kuvera] Later failure.',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(runDir, 'stdout.log'), secondStdoutText)
  fs.writeFileSync(path.join(runDir, 'stderr.log'), secondStderrText)

  const ackResult = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--ack',
      '--json-only',
      '--run-dir',
      runDir,
      '--state-file',
      statePath,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  assert.equal(ackResult.status, 0, ackResult.stderr)

  const payload = JSON.parse(ackResult.stdout)
  assert.equal(payload.acknowledgedCheckpointCompleted, 1200)
  assert.equal(payload.currentCheckpointCompleted, 1400)
  assert.equal(payload.nextCheckpointCompleted, 1300)
  assert.equal(payload.checkpointReady, true)

  const savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  assert.equal(savedState.acknowledgedCheckpointCompleted, 1300)
  assert.equal(savedState.acknowledgedStderrLength, firstStderrText.length)
  assert.deepEqual(savedState.pendingCheckpoints, [
    {
      checkpointCompleted: 1400,
      stderrLength: secondStderrText.length,
    },
  ])
})

test('monitorLocalScrapeRun can resync checkpoint tracking to the current completed checkpoint after a snapshot gap', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-local-scrape-run-resync-'))
  const runDir = path.join(tempDir, 'local-scrape-test')
  const statePath = path.join(runDir, 'monitor-state.json')
  fs.mkdirSync(runDir, { recursive: true })

  const stdoutText = [
    '[runner] Progress: 2447/4071 scrapers finished.',
    '',
  ].join('\n')
  const stderrText = [
    '  Ã— [karvy] UPSTREAM: [karvy] Historical failure before resync.',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(runDir, 'stdout.log'), stdoutText)
  fs.writeFileSync(path.join(runDir, 'stderr.log'), stderrText)
  fs.writeFileSync(statePath, JSON.stringify({
    acknowledgedCheckpointCompleted: 1200,
    acknowledgedStderrLength: 0,
    pendingCheckpoints: [],
  }, null, 2))

  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--resync-current',
      '--json-only',
      '--run-dir',
      runDir,
      '--state-file',
      statePath,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 0, result.stderr)

  const payload = JSON.parse(result.stdout)
  assert.equal(payload.completed, 2447)
  assert.equal(payload.currentCheckpointCompleted, 2400)

  const savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  assert.equal(savedState.acknowledgedCheckpointCompleted, 2400)
  assert.equal(savedState.acknowledgedStderrLength, stderrText.length)
  assert.deepEqual(savedState.pendingCheckpoints, [])
})
