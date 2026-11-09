import { readFileSync } from 'node:fs'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const DEFAULT_CSV_PATH = 'C:/Users/mohv/Downloads/company_list_extracted.csv'
const csvPath = process.argv[2] || DEFAULT_CSV_PATH
const csvText = readFileSync(csvPath, 'utf8')

const report = generateCompanyCoverageReport({
  csvText,
  catalog: getScraperCatalog(),
})

const matchedSources = report.matched.reduce((summary, item) => {
  summary[item.source] = (summary[item.source] || 0) + 1
  return summary
}, {})

const topCoveredSources = Object.entries(matchedSources)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, 20)

console.log(JSON.stringify({
  coverageLabel: report.coverageLabel,
  csvPath,
  totalRows: report.totalRows,
  candidateRows: report.candidateRows,
  matchedCount: report.matchedCount,
  unmatchedCount: report.unmatchedCount,
  topCoveredSources,
  unresolvedSample: report.unmatched.slice(0, 100).map((item) => item.companyName),
}, null, 2))
