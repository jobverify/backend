import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoDir = path.resolve(backendDir, '..')

const DEFAULT_INPUT_CSV_PATH = path.join(repoDir, 'missing_companies_from_coverage_report.csv')
const DEFAULT_OUTPUT_DIR = path.join(backendDir, 'artifacts', 'missing-company-coverage-2026-08-01')
const BATCH_COUNT = 6
const BATCH_LABEL = '09'
const VERIFIED_ON = '2026-08-01'
const VERIFIED_DATE_LABEL = 'Saturday, August 1, 2026'
const BATCH_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

const parseCsvCompanyNames = (csvText) =>
  String(csvText || '')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.replace(/^"|"$/g, '').replace(/""/g, '"').trim())
    .filter(Boolean)

const buildCoverageCsv = (companyNames = []) =>
  ['company_name', ...companyNames.map((companyName) => `"${String(companyName).replace(/"/g, '""')}"`)]
    .join('\n')
    .concat('\n')

const makeBaseSource = (companyName) =>
  String(companyName || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '')

const assignUniqueSources = ({ companyNames, existingSources }) => {
  const usedSources = new Set(existingSources)

  return companyNames.map((companyName) => {
    const baseSource = makeBaseSource(companyName) || 'company'
    let source = baseSource
    let suffix = 2

    while (usedSources.has(source)) {
      source = `${baseSource}${suffix}`
      suffix += 1
    }

    usedSources.add(source)

    return {
      companyName,
      source,
    }
  })
}

const buildBatchManifest = ({ batchLetter, companies }) => {
  const batchId = `${BATCH_LABEL}${batchLetter}`
  const folderName = `workbookbatch${batchId}`
  const providerExtensionFile = path.join(
    'scraper-support',
    'providers',
    'providerExtensions',
    `workbook-batch-${BATCH_LABEL}-${batchLetter}.json`,
  )
  const testFile = path.join(
    'scraper-support',
    'tests',
    `workbookBatch${batchId}Coverage.test.js`,
  )

  return {
    batchId,
    batchLabel: BATCH_LABEL,
    batchLetter,
    folderName,
    providerExtensionFile,
    testFile,
    verifiedOn: VERIFIED_ON,
    verifiedDateLabel: VERIFIED_DATE_LABEL,
    companies,
  }
}

export const buildMissingCompanyCoverageBatches = ({
  inputCsvPath = DEFAULT_INPUT_CSV_PATH,
  outputDir = DEFAULT_OUTPUT_DIR,
  catalog = getScraperCatalog(),
} = {}) => {
  const rawCsvText = readFileSync(inputCsvPath, 'utf8')
  const companyNames = parseCsvCompanyNames(rawCsvText)
  const report = generateCompanyCoverageReport({
    csvText: buildCoverageCsv(companyNames),
    catalog,
  })

  const unmatchedCompanyNames = report.unmatched.map((entry) => entry.companyName)
  const assignedCompanies = assignUniqueSources({
    companyNames: unmatchedCompanyNames,
    existingSources: catalog.map((provider) => provider.source),
  })

  const batches = Array.from({ length: BATCH_COUNT }, () => [])
  assignedCompanies.forEach((company, index) => {
    batches[index % BATCH_COUNT].push(company)
  })

  mkdirSync(outputDir, { recursive: true })

  const manifests = batches.map((companies, index) =>
    buildBatchManifest({
      batchLetter: BATCH_LETTERS[index],
      companies,
    }))

  for (const manifest of manifests) {
    const outputPath = path.join(outputDir, `batch-${manifest.batchId}.json`)
    writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  const summary = {
    inputCsvPath,
    outputDir,
    totalRows: companyNames.length,
    matchedCount: report.matchedCount,
    unmatchedCount: report.unmatchedCount,
    matchedCompanies: report.matched.map((entry) => entry.companyName),
    batchIds: manifests.map((manifest) => manifest.batchId),
    batchSizes: manifests.map((manifest) => manifest.companies.length),
  }

  writeFileSync(
    path.join(outputDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  )

  return summary
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const summary = buildMissingCompanyCoverageBatches()
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
