import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const inputPath = process.argv[2]

if (!inputPath) {
  console.error('Usage: node scripts/reportWorkbookBatchCoverage.js <batch-manifest.json|company-list.csv>')
  process.exit(1)
}

const resolvedPath = path.resolve(process.cwd(), inputPath)
const inputText = readFileSync(resolvedPath, 'utf8')

const buildCsvTextFromManifest = (manifestText) => {
  const manifest = JSON.parse(manifestText)
  const companies = Array.isArray(manifest?.companies) ? manifest.companies : []
  return `company_name\n${companies.map((company) => `"${String(company).replace(/"/g, '""')}"`).join('\n')}\n`
}

const csvText = resolvedPath.toLowerCase().endsWith('.json')
  ? buildCsvTextFromManifest(inputText)
  : inputText

const report = generateCompanyCoverageReport({
  csvText,
  catalog: getScraperCatalog(),
})

const providerImportBase = path.dirname(
  fileURLToPath(new URL('../scraper-support/providers/index.js', import.meta.url)),
)

const missingModuleProviders = report.matched
  .map((item) => item.provider)
  .filter((provider) => provider?.adapter === 'script' && provider?.modulePath)
  .map((provider) => ({
    source: provider.source,
    companyName: provider.companyName,
    modulePath: provider.modulePath,
    resolvedModulePath: path.resolve(providerImportBase, provider.modulePath),
  }))
  .filter((provider) => !existsSync(provider.resolvedModulePath))

console.log(JSON.stringify({
  inputPath: resolvedPath,
  totalRows: report.totalRows,
  candidateRows: report.candidateRows,
  matchedCount: report.matchedCount,
  unmatchedCount: report.unmatchedCount,
  matchedSources: report.matched.map((item) => ({
    companyName: item.companyName,
    source: item.source,
  })),
  unresolvedCompanies: report.unmatched.map((item) => item.companyName),
  missingModuleProviders,
}, null, 2))
