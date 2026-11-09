import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { getCompanyAliasMap } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import {
  buildCsvScrapeRunConfig,
  resolveScraperSourcesFromCsv,
} from '../scripts/scrapeCompaniesFromCsv.js'

const NEW_COMPANIES_CSV_PATH = path.resolve(import.meta.dirname, '../../new_Companies.csv')
const backendDir = path.resolve(import.meta.dirname, '..')

test('resolveScraperSourcesFromCsv collapses alias-backed rows onto unique source ids', () => {
  const summary = resolveScraperSourcesFromCsv({
    csvText: 'company_name\nFreshdesk\nFreshservice\nOpen\n',
    catalog: [
      { source: 'freshworks', companyName: 'Freshworks', adapter: 'apiPortal' },
      {
        source: 'openfinancialtechnologies',
        companyName: 'Open Financial Technologies',
        adapter: 'apiPortal',
      },
    ],
    aliasMap: {
      Freshdesk: 'freshworks',
      Freshservice: 'freshworks',
      Open: 'openfinancialtechnologies',
    },
  })

  assert.equal(summary.report.matchedCount, 3)
  assert.equal(summary.report.unmatchedCount, 0)
  assert.equal(summary.uniqueSourceCount, 2)
  assert.equal(summary.collapsedCompanyCount, 1)
  assert.deepEqual(summary.selectedSources, [
    'freshworks',
    'openfinancialtechnologies',
  ])
})

test('resolveScraperSourcesFromCsv reports unresolved names and missing script modules', () => {
  const summary = resolveScraperSourcesFromCsv({
    csvText: 'company_name\nMissing Company\nBroken Script Co\n',
    catalog: [
      {
        source: 'brokenscriptco',
        companyName: 'Broken Script Co',
        adapter: 'script',
        modulePath: '../does-not-exist/script.js',
      },
    ],
    aliasMap: {},
  })

  assert.equal(summary.report.matchedCount, 1)
  assert.equal(summary.report.unmatchedCount, 1)
  assert.deepEqual(summary.unresolvedCompanies, ['Missing Company'])
  assert.deepEqual(
    summary.missingModuleProviders.map((provider) => ({
      source: provider.source,
      reason: provider.reason,
    })),
    [
      {
        source: 'brokenscriptco',
        reason: 'missing module file',
      },
    ],
  )
})

test('buildCsvScrapeRunConfig resolves the real new_Companies.csv backlog into a runnable source list', () => {
  if (!existsSync(NEW_COMPANIES_CSV_PATH)) {
    return
  }

  const config = buildCsvScrapeRunConfig({
    csvPath: NEW_COMPANIES_CSV_PATH,
    runnerArgs: ['--parallel', '--dry-run'],
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
    sourceEnv: { SAMPLE_ENV: 'kept' },
  })

  assert.equal(config.report.unmatchedCount, 0)
  assert.equal(config.unresolvedCompanies.length, 0)
  assert.equal(config.selectedSources.length, config.uniqueSourceCount)
  assert.ok(config.uniqueSourceCount > 0)
  assert.ok(config.selectedSources.includes('freshworks'))
  assert.ok(config.selectedSources.includes('amazon'))
  assert.equal(config.env.SAMPLE_ENV, 'kept')
  assert.equal(config.env.SCRAPER_ONLY, config.selectedSources.join(','))
  assert.deepEqual(config.forwardedRunnerArgs, ['--parallel', '--dry-run'])
})

test('scrapeCompaniesFromCsv CLI emits a JSON summary in --json-only mode', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-scrape-csv-'))

  try {
    const csvPath = path.join(tempDir, 'companies.csv')
    writeFileSync(csvPath, 'company_name\nFreshdesk\nOpen\n', 'utf8')

    const stdout = execFileSync(
      process.execPath,
      [
        'scripts/scrapeCompaniesFromCsv.js',
        csvPath,
        '--json-only',
        '--parallel',
        '--dry-run',
      ],
      {
        cwd: backendDir,
        encoding: 'utf8',
      },
    )

    const summary = JSON.parse(stdout)
    assert.equal(summary.csvPath, csvPath)
    assert.equal(summary.unmatchedCount, 0)
    assert.deepEqual(summary.selectedSources, [
      'freshworks',
      'openfinancialtechnologies',
    ])
    assert.deepEqual(summary.forwardedRunnerArgs, ['--parallel', '--dry-run'])
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
