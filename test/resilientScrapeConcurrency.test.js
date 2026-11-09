import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildLocalScrapeRunEnv } from '../scripts/localScrapeRunEnv.js'
import { resolveConfiguredParallelScraperConcurrency } from '../scraper-support/utils/parallelConcurrency.js'

const launcher = fileURLToPath(new URL('../scripts/startResilientMongoScrape.ps1', import.meta.url))

const launch = (t, { concurrency, argument, mode = '-Live' } = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-concurrency-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const script = path.join(directory, 'backend', 'scripts', 'startResilientMongoScrape.ps1')
  fs.mkdirSync(path.dirname(script), { recursive: true })
  fs.copyFileSync(launcher, script)
  const output = path.join(directory, 'forwarded-env.json')
  const env = {
    ...process.env,
    CONCURRENCY_TEST_SCRIPT: script,
    CONCURRENCY_TEST_RUN_DIR: path.join(directory, 'run'),
    CONCURRENCY_TEST_OUTPUT: output,
  }
  delete env.SCRAPER_CONCURRENCY
  if (concurrency !== undefined) env.SCRAPER_CONCURRENCY = concurrency

  // Replace only the external supervisor process. The real PowerShell launcher
  // runs in an isolated workspace and exposes the environment it forwards.
  const command = `
    function node {
      @{ concurrency = $env:SCRAPER_CONCURRENCY } | ConvertTo-Json -Compress |
        Set-Content -LiteralPath $env:CONCURRENCY_TEST_OUTPUT -Encoding UTF8
      $global:LASTEXITCODE = 0
    }
    & $env:CONCURRENCY_TEST_SCRIPT ${mode} -Foreground -NoClean -RunDir $env:CONCURRENCY_TEST_RUN_DIR ${argument ? `-Concurrency ${argument}` : ''}
  `
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    env, encoding: 'utf8', timeout: 15_000, windowsHide: true,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(fs.readFileSync(output, 'utf8').replace(/^\uFEFF/, '')).concurrency
}

for (const mode of ['-Live', '-DryRun']) {
  test(`resilient ${mode} launcher forwards SCRAPER_CONCURRENCY without an argument`, { skip: process.platform !== 'win32' }, t => {
    assert.equal(launch(t, { concurrency: '5', mode }), '5')
  })
}

test('resilient launcher preserves an explicitly supplied concurrency argument', { skip: process.platform !== 'win32' }, t => {
  assert.equal(launch(t, { concurrency: '5', argument: '3' }), '3')
})

test('resilient launcher leaves unset concurrency available for .env and runner defaults', { skip: process.platform !== 'win32' }, t => {
  const concurrency = launch(t)
  assert.ok(concurrency == null || concurrency === '')
  const inherited = concurrency ? { SCRAPER_CONCURRENCY: concurrency } : {}
  assert.equal(buildLocalScrapeRunEnv(inherited, { SCRAPER_CONCURRENCY: '7' }).SCRAPER_CONCURRENCY, '7')
  assert.equal(resolveConfiguredParallelScraperConcurrency(buildLocalScrapeRunEnv(inherited, {}).SCRAPER_CONCURRENCY ?? ''), 1)
})
