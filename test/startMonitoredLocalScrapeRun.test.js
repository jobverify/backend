import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import {
  buildDryRunExperienceMonitorConfig,
  DEFAULT_DRY_RUN_EXPERIENCE_MONITOR_SLEEP_SECONDS,
  parseArgs,
  resolveDryRunScraperDir,
} from '../scripts/startMonitoredLocalScrapeRun.js'

test('parseArgs enables the dry-run experience monitor by default', () => {
  const options = parseArgs([])

  assert.equal(options.dryRun, true)
  assert.equal(options.parallel, true)
  assert.equal(options.experienceMonitor, true)
  assert.equal(
    options.experienceMonitorSleepSeconds,
    DEFAULT_DRY_RUN_EXPERIENCE_MONITOR_SLEEP_SECONDS,
  )
})

test('parseArgs can disable the dry-run experience monitor and override the polling interval', () => {
  const options = parseArgs([
    '--no-experience-monitor',
    '--experience-monitor-sleep-seconds', '45',
  ])

  assert.equal(options.experienceMonitor, false)
  assert.equal(options.experienceMonitorSleepSeconds, 45)
})

test('buildDryRunExperienceMonitorConfig prepares the Windows PowerShell monitor for dry runs', () => {
  const runDir = path.resolve('C:/repo/artifacts/run-logs/local-scrape-20260812T233000')
  const stdoutPath = path.join(runDir, 'stdout.log')
  const backendDir = path.resolve('C:/repo/jobverify-backend')
  const scraperDir = path.join(backendDir, 'scraper')
  const backfillScriptPath = path.join(backendDir, 'scripts', 'backfillDryRunExperience.js')

  const config = buildDryRunExperienceMonitorConfig({
    dryRun: true,
    experienceMonitor: true,
    platform: 'win32',
    runDir,
    stdoutPath,
    backendDir,
    scraperDir,
    backfillScriptPath,
    sleepSeconds: 60,
  })

  assert.ok(config)
  assert.equal(config.command, 'powershell.exe')
  assert.deepEqual(config.args.slice(0, 3), [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
  ])
  assert.match(config.monitorScript, /monitorCurrentDryRunExperience\.ps1$/)
  assert.equal(config.stdoutPath, path.join(runDir, 'experience-monitor.log'))
  assert.equal(config.stderrPath, path.join(runDir, 'experience-monitor.err.log'))
  assert.equal(config.pidPath, path.join(runDir, 'experience-monitor.pid'))
  assert.equal(config.scraperDir, scraperDir)
  assert.equal(config.backfillScriptPath, backfillScriptPath)
  assert.equal(config.sleepSeconds, 60)
  assert.ok(config.args.includes(stdoutPath))
  assert.ok(config.args.includes(backendDir))
  assert.ok(config.args.includes(scraperDir))
  assert.ok(config.args.includes(backfillScriptPath))
})

test('resolveDryRunScraperDir prefers the shared absolute dry-run root from the catalog', () => {
  const fallbackDir = path.resolve('/repo/jobverify-backend/scraper')
  const sharedDir = path.resolve('/external/jobverify-backend/scraper')
  const resolved = resolveDryRunScraperDir({
    fallbackDir,
    scrapers: [
      { dryRunFile: path.join(sharedDir, 'alpha', 'jobs.json') },
      { dryRunFile: path.join(sharedDir, 'virtusa', 'jobs.json') },
    ],
  })

  assert.equal(path.normalize(resolved), sharedDir)
})

test('resolveDryRunScraperDir falls back when absolute dry-run roots disagree', () => {
  const fallbackDir = path.resolve('/repo/jobverify-backend/scraper')
  const resolved = resolveDryRunScraperDir({
    fallbackDir,
    scrapers: [
      { dryRunFile: path.resolve('/external-a/jobverify-backend/scraper/alpha/jobs.json') },
      { dryRunFile: path.resolve('/external-b/jobverify-backend/scraper/virtusa/jobs.json') },
    ],
  })

  assert.equal(resolved, fallbackDir)
})

test('buildDryRunExperienceMonitorConfig skips unsupported dry-run monitor scenarios', () => {
  assert.equal(buildDryRunExperienceMonitorConfig({
    dryRun: false,
    experienceMonitor: true,
    platform: 'win32',
    runDir: 'C:/repo/run',
    stdoutPath: 'C:/repo/run/stdout.log',
  }), null)

  assert.equal(buildDryRunExperienceMonitorConfig({
    dryRun: true,
    experienceMonitor: false,
    platform: 'win32',
    runDir: 'C:/repo/run',
    stdoutPath: 'C:/repo/run/stdout.log',
  }), null)

  assert.equal(buildDryRunExperienceMonitorConfig({
    dryRun: true,
    experienceMonitor: true,
    platform: 'linux',
    runDir: 'C:/repo/run',
    stdoutPath: 'C:/repo/run/stdout.log',
  }), null)
})
