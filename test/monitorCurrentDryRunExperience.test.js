import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..')
const monitorScriptPath = path.join(repoRoot, 'scripts', 'monitorCurrentDryRunExperience.ps1')

test('monitorCurrentDryRunExperience stops after one repair pass when the runner already exited', (t) => {
  if (process.platform !== 'win32') {
    t.skip('PowerShell dry-run experience monitor is only used on Windows')
    return
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-current-dry-run-experience-'))
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }))
  const runDir = path.join(tempDir, 'local-scrape-test')
  const scraperDir = path.join(tempDir, 'scraper')
  const pipelineLogPath = path.join(runDir, 'pipeline.log')
  const invocationPath = path.join(tempDir, 'invocations.txt')
  const stubBackfillScriptPath = path.join(tempDir, 'stub-backfill.mjs')

  fs.mkdirSync(runDir, { recursive: true })
  fs.mkdirSync(scraperDir, { recursive: true })
  fs.writeFileSync(
    pipelineLogPath,
    [
      '[runner] Progress: 1/2 scrapers finished.',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(runDir, 'run-exit.json'),
    JSON.stringify({
      exitedAt: '2026-08-13T06:40:00.000Z',
      code: 130,
      signal: null,
    }, null, 2),
  )
  fs.writeFileSync(
    stubBackfillScriptPath,
    [
      "import fs from 'node:fs'",
      '',
      "const invocationPath = process.env.MONITOR_TEST_INVOCATION_PATH",
      'const priorCount = fs.existsSync(invocationPath)',
      "  ? Number.parseInt(fs.readFileSync(invocationPath, 'utf8'), 10) || 0",
      '  : 0',
      "fs.writeFileSync(invocationPath, String(priorCount + 1), 'utf8')",
      '',
    ].join('\n'),
  )

  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      monitorScriptPath,
      '-LogPath',
      pipelineLogPath,
      '-BackendDir',
      repoRoot,
      '-ScraperDir',
      scraperDir,
      '-BackfillScriptPath',
      stubBackfillScriptPath,
      '-SleepSeconds',
      '1',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      // A cold PowerShell + Node launch exceeds five seconds under suite load.
      // Keep a bounded deadline while asserting the repair still runs exactly once.
      timeout: 30_000,
      windowsHide: true,
      env: {
        ...process.env,
        MONITOR_TEST_INVOCATION_PATH: invocationPath,
      },
    },
  )

  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.equal(fs.readFileSync(invocationPath, 'utf8'), '1')
})
