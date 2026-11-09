import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  generateCompanyCoverageReport,
  getCompanyAliasMap,
} from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoRoot = path.resolve(backendDir, '..')
const providersDir = path.join(backendDir, 'scraper-support', 'providers')

export const DEFAULT_COMPANIES_CSV_PATH = path.join(repoRoot, 'new_Companies.csv')
export const DEFAULT_RUNNER_PATH = path.join(backendDir, 'scraper-support', 'runner.js')

const normalizeRunnerArgs = (runnerArgs = []) =>
  runnerArgs
    .map((arg) => String(arg || '').trim())
    .filter(Boolean)

const resolveScriptProviderModule = (provider) => {
  if (!provider?.modulePath) {
    return {
      source: provider?.source || null,
      companyName: provider?.companyName || provider?.company || null,
      modulePath: provider?.modulePath || null,
      resolvedModulePath: null,
      reason: 'missing modulePath',
    }
  }

  const resolvedModulePath = path.isAbsolute(provider.modulePath)
    ? provider.modulePath
    : path.resolve(providersDir, provider.modulePath)

  if (existsSync(resolvedModulePath)) return null

  return {
    source: provider.source,
    companyName: provider.companyName || provider.company || null,
    modulePath: provider.modulePath,
    resolvedModulePath,
    reason: 'missing module file',
  }
}

export const resolveScraperSourcesFromCsv = ({
  csvText,
  catalog = getScraperCatalog(),
  aliasMap = getCompanyAliasMap(),
} = {}) => {
  assert.equal(typeof csvText, 'string', 'csvText must be a string.')

  const report = generateCompanyCoverageReport({
    csvText,
    catalog,
    aliasMap,
  })
  const providersBySource = new Map(catalog.map((provider) => [provider.source, provider]))
  const selectedSources = []
  const seenSources = new Set()

  for (const item of report.matched) {
    if (seenSources.has(item.source)) continue
    seenSources.add(item.source)
    selectedSources.push(item.source)
  }

  const selectedProviders = selectedSources
    .map((source) => providersBySource.get(source))
    .filter(Boolean)
  const missingModuleProviders = selectedProviders
    .filter((provider) => provider.adapter === 'script')
    .map((provider) => resolveScriptProviderModule(provider))
    .filter(Boolean)

  return {
    report,
    selectedSources,
    uniqueSourceCount: selectedSources.length,
    collapsedCompanyCount: report.matchedCount - selectedSources.length,
    unresolvedCompanies: report.unmatched.map((item) => item.companyName),
    missingModuleProviders,
  }
}

export const buildCsvScrapeRunConfig = ({
  csvPath = DEFAULT_COMPANIES_CSV_PATH,
  runnerArgs = [],
  catalog = getScraperCatalog(),
  aliasMap = getCompanyAliasMap(),
  sourceEnv = process.env,
} = {}) => {
  const resolvedCsvPath = path.resolve(csvPath)
  const csvText = readFileSync(resolvedCsvPath, 'utf8')
  const resolution = resolveScraperSourcesFromCsv({
    csvText,
    catalog,
    aliasMap,
  })
  const forwardedRunnerArgs = normalizeRunnerArgs(runnerArgs)

  return {
    csvPath: resolvedCsvPath,
    ...resolution,
    env: {
      ...sourceEnv,
      SCRAPER_ONLY: resolution.selectedSources.join(','),
    },
    runnerPath: DEFAULT_RUNNER_PATH,
    runnerArgs: [DEFAULT_RUNNER_PATH, ...forwardedRunnerArgs],
    forwardedRunnerArgs,
  }
}

export const summarizeCsvScrapeRunConfig = (config) => ({
  csvPath: config.csvPath,
  totalRows: config.report.totalRows,
  candidateRows: config.report.candidateRows,
  matchedCount: config.report.matchedCount,
  unmatchedCount: config.report.unmatchedCount,
  uniqueSourceCount: config.uniqueSourceCount,
  collapsedCompanyCount: config.collapsedCompanyCount,
  selectedSources: config.selectedSources,
  unresolvedCompanies: config.unresolvedCompanies,
  missingModuleProviders: config.missingModuleProviders,
  forwardedRunnerArgs: config.forwardedRunnerArgs,
})

const getValidationIssues = (config) => {
  const issues = []

  if (config.report.candidateRows === 0) {
    issues.push('The CSV did not contain any candidate company rows to scrape.')
  }

  if (config.unresolvedCompanies.length > 0) {
    issues.push(
      `Unresolved companies (${config.unresolvedCompanies.length}): ${config.unresolvedCompanies.slice(0, 20).join(', ')}`,
    )
  }

  if (config.selectedSources.length === 0) {
    issues.push('No scraper sources were resolved from the CSV input.')
  }

  if (config.missingModuleProviders.length > 0) {
    issues.push(
      `Resolved script providers with missing modules (${config.missingModuleProviders.length}): ${config.missingModuleProviders
        .slice(0, 20)
        .map((provider) => `${provider.source} (${provider.reason})`)
        .join(', ')}`,
    )
  }

  return issues
}

const printRunBanner = (config) => {
  console.log(
    `[csv-scrape] Resolved ${config.report.matchedCount}/${config.report.candidateRows} candidate companies from ${config.csvPath} to ${config.uniqueSourceCount} unique scraper sources.`,
  )

  if (config.collapsedCompanyCount > 0) {
    console.log(
      `[csv-scrape] Collapsed ${config.collapsedCompanyCount} alias-backed company rows onto existing scraper sources.`,
    )
  }

  console.log(
    '[csv-scrape] Launching the existing runner with SCRAPER_ONLY so retries, timeouts, and persistence remain centralized in scraper-support/runner.js.',
  )
}

export const runScrapeCompaniesFromCsv = (options = {}) => {
  const config = buildCsvScrapeRunConfig(options)
  const issues = getValidationIssues(config)

  if (issues.length > 0) {
    const error = new Error(issues.join('\n'))
    error.summary = summarizeCsvScrapeRunConfig(config)
    throw error
  }

  printRunBanner(config)

  const result = spawnSync(process.execPath, config.runnerArgs, {
    cwd: backendDir,
    env: config.env,
    stdio: 'inherit',
    windowsHide: true,
  })

  if (result.error) throw result.error

  return {
    ...summarizeCsvScrapeRunConfig(config),
    exitCode: result.status ?? (result.signal ? 1 : 0),
    signal: result.signal || null,
  }
}

const printUsage = () => {
  console.log(
    [
      'Usage: node scripts/scrapeCompaniesFromCsv.js [csvPath] [--json-only] [runner args]',
      '',
      'Examples:',
      '  node scripts/scrapeCompaniesFromCsv.js',
      '  node scripts/scrapeCompaniesFromCsv.js ../new_Companies.csv --parallel --dry-run',
      '  npm run scrape:csv -- --parallel --dry-run',
    ].join('\n'),
  )
}

const parseArgs = (argv) => {
  const options = {
    csvPath: DEFAULT_COMPANIES_CSV_PATH,
    jsonOnly: false,
    help: false,
    runnerArgs: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg === '--json-only') {
      options.jsonOnly = true
      continue
    }

    if (arg === '--csv') {
      options.csvPath = argv[index + 1] || options.csvPath
      index += 1
      continue
    }

    if (arg === '--') {
      options.runnerArgs.push(...argv.slice(index + 1))
      break
    }

    if (!arg.startsWith('--') && options.csvPath === DEFAULT_COMPANIES_CSV_PATH) {
      options.csvPath = arg
      continue
    }

    options.runnerArgs.push(arg)
  }

  return options
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const options = parseArgs(process.argv.slice(2))

    if (options.help) {
      printUsage()
      process.exit(0)
    }

    const config = buildCsvScrapeRunConfig(options)
    const summary = summarizeCsvScrapeRunConfig(config)
    const issues = getValidationIssues(config)

    if (options.jsonOnly) {
      console.log(JSON.stringify(summary, null, 2))
      process.exit(issues.length > 0 ? 1 : 0)
    }

    if (issues.length > 0) {
      console.error(issues.join('\n'))
      process.exit(1)
    }

    const result = runScrapeCompaniesFromCsv(options)
    process.exit(result.exitCode)
  } catch (error) {
    console.error(error.message || error)
    process.exit(1)
  }
}
