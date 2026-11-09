import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildScrapers } from '../scraper-support/providers/index.js'
import {
  classifyScraperError,
  resolveScraperRetryAttempts,
  runScraperWithTimeout,
} from '../scraper-support/runner.js'
import { mapWithConcurrency } from '../scraper-support/utils/mapWithConcurrency.js'
import { resolveConfiguredParallelScraperConcurrency } from '../scraper-support/utils/parallelConcurrency.js'
import { withRetry } from '../scraper-support/utils/retry.js'
import { saveDryRunSnapshot } from '../scraper-support/utils/saveToDB.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const scraperRoot = path.join(backendDir, 'scraper')
const outputDir = path.join(backendDir, 'artifacts', 'coverage-gap-analysis')
const DRY_RUN_EXPERIENCE_ENRICHMENT_CONCURRENCY = 2

const parseArgValue = (flag) => {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeSourceSet = (value) => new Set(
  String(value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
)

const timestampForFilename = (date = new Date()) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

const readMissingDirectories = () => fs.readdirSync(scraperRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    folder: entry.name,
    folderPath: path.join(scraperRoot, entry.name),
    jobsPath: path.join(scraperRoot, entry.name, 'jobs.json'),
  }))
  .filter((entry) => !fs.existsSync(entry.jobsPath))

const buildSelection = ({ onlySources = new Set(), limit = null } = {}) => {
  const missingDirs = readMissingDirectories()
  const scrapers = buildScrapers()
  const scraperByDir = new Map(
    scrapers.map((scraper) => [path.dirname(scraper.dryRunFile), scraper]),
  )

  const mapped = []
  const unmapped = []

  for (const entry of missingDirs) {
    const scraper = scraperByDir.get(entry.folderPath)
    if (!scraper) {
      unmapped.push(entry)
      continue
    }

    if (onlySources.size > 0 && !onlySources.has(scraper.name.toLowerCase())) {
      continue
    }

    mapped.push({
      ...entry,
      scraper,
    })
  }

  const selected = limit == null ? mapped : mapped.slice(0, limit)
  return { selected, mapped, unmapped, missingDirs, totalCatalogScrapers: scrapers.length }
}

const summariseCounts = (rows, keyer) => Object.fromEntries(
  [...rows.reduce((map, row) => {
    const key = keyer(row)
    map.set(key, (map.get(key) || 0) + 1)
    return map
  }, new Map()).entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
)

const runOne = async ({ scraper, folder }) => {
  const startedAt = Date.now()

  try {
    if (fs.existsSync(scraper.dryRunFile)) {
      fs.rmSync(scraper.dryRunFile, { force: true })
    }

    const jobs = await withRetry(
      () => runScraperWithTimeout(scraper),
      {
        attempts: resolveScraperRetryAttempts(scraper),
        baseDelayMs: 2000,
        label: scraper.name,
      },
    )

    const normalizedJobs = await saveDryRunSnapshot(jobs, scraper.dryRunFile, {
      experienceEnrichmentConcurrency: DRY_RUN_EXPERIENCE_ENRICHMENT_CONCURRENCY,
    })

    console.log(
      `  [ok] [${scraper.name}] ${normalizedJobs.length} India jobs -> ${scraper.dryRunFile}`,
    )

    return {
      source: scraper.name,
      folder,
      success: true,
      jobs: normalizedJobs.length,
      dryRunFile: scraper.dryRunFile,
      adapter: scraper.provider?.adapter ?? null,
      atsPlatform: scraper.provider?.atsPlatform ?? null,
      companyCareerPage: scraper.provider?.companyCareerPage ?? null,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    const classification = classifyScraperError(error)
    console.error(`  [fail] [${scraper.name}] ${error.message}`)

    return {
      source: scraper.name,
      folder,
      success: false,
      error: error.message,
      dryRunFile: scraper.dryRunFile,
      adapter: scraper.provider?.adapter ?? null,
      atsPlatform: scraper.provider?.atsPlatform ?? null,
      companyCareerPage: scraper.provider?.companyCareerPage ?? null,
      durationMs: Date.now() - startedAt,
      ...classification,
    }
  }
}

const main = async () => {
  const onlySources = normalizeSourceSet(parseArgValue('--only'))
  const limitArg = parseArgValue('--limit')
  const limit = limitArg == null ? null : parsePositiveInt(limitArg, null)
  const concurrency = parsePositiveInt(parseArgValue('--concurrency'), resolveConfiguredParallelScraperConcurrency())
  const label = parseArgValue('--label') || 'missing-dry-run-backfill'
  const startedAtIso = new Date().toISOString()

  const selection = buildSelection({ onlySources, limit })
  const { selected, mapped, unmapped, missingDirs, totalCatalogScrapers } = selection

  console.log('============================================================')
  console.log('  Missing Dry-Run Artifact Backfill')
  console.log(`  Started: ${startedAtIso}`)
  console.log(`  Total catalog scrapers: ${totalCatalogScrapers}`)
  console.log(`  Current missing folders: ${missingDirs.length}`)
  console.log(`  Mapped missing folders: ${mapped.length}`)
  console.log(`  Unmapped missing folders: ${unmapped.length}`)
  console.log(`  Selected for this pass: ${selected.length}`)
  console.log(`  Concurrency: ${concurrency}`)
  console.log('============================================================')
  console.log()

  const results = await mapWithConcurrency(selected, concurrency, async (entry, index) => {
    console.log(`[${index + 1}/${selected.length}] ${entry.scraper.name}`)
    return runOne(entry)
  })

  const successes = results.filter((row) => row.success)
  const failures = results.filter((row) => !row.success)
  const completedAtIso = new Date().toISOString()

  const report = {
    label,
    startedAt: startedAtIso,
    completedAt: completedAtIso,
    selectedCount: selected.length,
    successCount: successes.length,
    failureCount: failures.length,
    totalMissingBeforeRun: missingDirs.length,
    mappedMissingBeforeRun: mapped.length,
    unmappedMissingBeforeRun: unmapped.map((entry) => entry.folder),
    successByAtsPlatform: summariseCounts(successes, (row) => row.atsPlatform || 'unknown'),
    failureByKind: summariseCounts(failures, (row) => row.failureKind || 'unknown'),
    failureByAtsPlatform: summariseCounts(failures, (row) => row.atsPlatform || 'unknown'),
    results,
  }

  await fs.promises.mkdir(outputDir, { recursive: true })
  const stamp = timestampForFilename(new Date())
  const reportPath = path.join(outputDir, `${label}-${stamp}.json`)
  const failurePath = path.join(outputDir, `${label}-${stamp}.failures.json`)

  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await fs.promises.writeFile(failurePath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8')

  console.log()
  console.log('Backfill summary:')
  console.log(`  Successes: ${successes.length}`)
  console.log(`  Failures: ${failures.length}`)
  console.log(`  Report: ${reportPath}`)
  console.log(`  Failure report: ${failurePath}`)
}

await main()
