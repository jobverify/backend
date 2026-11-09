import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport, getCompanyAliasMap, normalizeCompanyName } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const scraperDir = path.join(backendDir, 'scraper')
export const DEFAULT_BACKEND_REPORT_PATH = path.join(backendDir, 'company_coverage_report.json')
export const DEFAULT_FRONTEND_REPORT_PATH = null

const buildReportFromProviderCatalog = ({ catalog } = {}) => {
  const providers = [...catalog].sort((left, right) => left.source.localeCompare(right.source))
  const matched = providers.map((provider, index) => {
    const source = provider.source
    const companyName = provider.companyName || provider.company || source

    return {
      row: String(index + 1),
      companyName,
      normalizedCompanyName: normalizeCompanyName(companyName),
      source,
      provider: provider || null,
    }
  })

  return {
    totalRows: providers.length,
    coverageLabel: 'Catalog registration coverage',
    candidateRows: providers.length,
    matchedCount: matched.length,
    unmatchedCount: 0,
    matched,
    unmatched: [],
  }
}

export const regenerateCompanyCoverageReport = ({
  csvPath,
  backendReportPath = DEFAULT_BACKEND_REPORT_PATH,
  frontendReportPath = DEFAULT_FRONTEND_REPORT_PATH,
  catalog = getScraperCatalog(),
  aliasMap = getCompanyAliasMap(),
  scraperDirectoryPath = scraperDir,
} = {}) => {
  const resolvedBackendReportPath = path.resolve(backendReportPath)
  const resolvedFrontendReportPath = frontendReportPath
    ? path.resolve(frontendReportPath)
    : null
  const resolvedScraperDirectoryPath = path.resolve(scraperDirectoryPath)
  const resolvedCsvPath = csvPath ? path.resolve(csvPath) : null
  const report = resolvedCsvPath
    ? generateCompanyCoverageReport({
      csvText: readFileSync(resolvedCsvPath, 'utf8'),
      catalog,
      aliasMap,
    })
    : buildReportFromProviderCatalog({ catalog })

  const serializedReport = `${JSON.stringify(report, null, 2)}\n`
  writeFileSync(resolvedBackendReportPath, serializedReport)
  if (resolvedFrontendReportPath) {
    writeFileSync(resolvedFrontendReportPath, serializedReport)
  }

  return {
    sourceType: resolvedCsvPath ? 'csv-file' : 'provider-catalog',
    coverageLabel: report.coverageLabel,
    source: resolvedCsvPath || path.join(resolvedScraperDirectoryPath, '..', 'scraper-support', 'providers', 'index.js'),
    backendReportPath: resolvedBackendReportPath,
    frontendReportPath: resolvedFrontendReportPath,
    totalRows: report.totalRows,
    candidateRows: report.candidateRows,
    matchedCount: report.matchedCount,
    unmatchedCount: report.unmatchedCount,
    unresolvedSample: report.unmatched.slice(0, 20).map((item) => item.companyName),
  }
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const cliCsvPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : undefined
  const cliBackendReportPath = process.argv[3]
    ? path.resolve(process.cwd(), process.argv[3])
    : undefined
  const cliFrontendReportPath = process.argv[4]
    ? path.resolve(process.cwd(), process.argv[4])
    : undefined
  const summary = regenerateCompanyCoverageReport({
    csvPath: cliCsvPath,
    backendReportPath: cliBackendReportPath,
    frontendReportPath: cliFrontendReportPath,
  })

  console.log(JSON.stringify(summary, null, 2))
}
