import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCompanyName } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { getDiskBackedScraperSources } from '../scraper-support/providers/sourceInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoDir = path.resolve(backendDir, '..')
const scraperDir = path.join(backendDir, 'scraper')

const backendReportPath = path.join(backendDir, 'company_coverage_report.json')
const obsoleteLiveHiringCompaniesPath = path.join(
  repoDir,
  'jobverify-frontend',
  'public',
  'live_hiring_companies.json',
)
const deprecatedFrontendRawReportPath = path.join(
  repoDir,
  'jobverify-frontend',
  'public',
  'company_coverage_report.json',
)

export const buildScraperCoverageReport = ({
  catalog,
  scraperDirectories,
} = {}) => {
  const catalogSources = new Set(catalog.map((provider) => provider.source))
  const sourceDirs = getDiskBackedScraperSources({
    catalog,
    scraperDirectories,
  })
  const skippedDirs = scraperDirectories.filter((dirName) => !catalogSources.has(dirName))
  const providersBySource = new Map(catalog.map((provider) => [provider.source, provider]))
  const matched = sourceDirs.map((source, index) => {
    const provider = providersBySource.get(source)
    const companyName = provider?.companyName || provider?.company || source

    return {
      row: String(index + 1),
      companyName,
      normalizedCompanyName: normalizeCompanyName(companyName),
      source,
      provider: provider || null,
    }
  })

  return {
    report: {
      totalRows: sourceDirs.length,
      candidateRows: sourceDirs.length,
      matchedCount: matched.length,
      unmatchedCount: 0,
      matched,
      unmatched: [],
    },
    sourceDirs,
    skippedDirs,
  }
}

export const syncCompanyCoverageReportsFromScraper = ({
  scraperDirectoryPath = scraperDir,
  backendReportPath: outputBackendReportPath = backendReportPath,
  obsoleteLiveHiringCompaniesPath: outputObsoleteLiveHiringCompaniesPath = obsoleteLiveHiringCompaniesPath,
  deprecatedFrontendRawReportPath: outputDeprecatedFrontendRawReportPath = deprecatedFrontendRawReportPath,
  catalog = getScraperCatalog(),
  scraperDirectories = readdirSync(scraperDirectoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right)),
} = {}) => {
  const { report, sourceDirs, skippedDirs } = buildScraperCoverageReport({
    catalog,
    scraperDirectories,
  })
  writeFileSync(outputBackendReportPath, `${JSON.stringify(report, null, 2)}\n`)
  rmSync(outputObsoleteLiveHiringCompaniesPath, { force: true })
  rmSync(outputDeprecatedFrontendRawReportPath, { force: true })

  return {
    scraperDir: scraperDirectoryPath,
    backendReportPath: outputBackendReportPath,
    obsoleteLiveHiringCompaniesPath: outputObsoleteLiveHiringCompaniesPath,
    deprecatedFrontendRawReportPath: outputDeprecatedFrontendRawReportPath,
    totalScraperDirs: scraperDirectories.length,
    sourceDirCount: sourceDirs.length,
    skippedDirCount: skippedDirs.length,
    skippedDirs,
    matchedCount: report.matchedCount,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(syncCompanyCoverageReportsFromScraper(), null, 2))
}
