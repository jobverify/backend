import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')

const backendReportPath = path.join(backendDir, 'company_coverage_report.json')

const escapeCsvValue = (value) => {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text

  return `"${text.replaceAll('"', '""')}"`
}

const buildCsvFromExistingReport = () => {
  const existingReport = JSON.parse(readFileSync(backendReportPath, 'utf8'))
  if (!Array.isArray(existingReport.matched)) {
    throw new Error(`${backendReportPath} does not contain a matched company list`)
  }

  return `${existingReport.matched
    .map((item) => escapeCsvValue(item.companyName))
    .join('\n')}\n`
}

const inputCsvPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null
const outputFrontendReportPath = process.argv[3]
  ? path.resolve(process.cwd(), process.argv[3])
  : null
const csvText = inputCsvPath
  ? readFileSync(inputCsvPath, 'utf8')
  : buildCsvFromExistingReport()

const report = generateCompanyCoverageReport({
  csvText,
  catalog: getScraperCatalog(),
})

const serializedReport = `${JSON.stringify(report, null, 2)}\n`
writeFileSync(backendReportPath, serializedReport)
if (outputFrontendReportPath) {
  writeFileSync(outputFrontendReportPath, serializedReport)
}

console.log(JSON.stringify({
  source: inputCsvPath || backendReportPath,
  backendReportPath,
  frontendReportPath: outputFrontendReportPath,
  totalRows: report.totalRows,
  candidateRows: report.candidateRows,
  matchedCount: report.matchedCount,
  unmatchedCount: report.unmatchedCount,
  unresolvedSample: report.unmatched.slice(0, 20).map((item) => item.companyName),
}, null, 2))
