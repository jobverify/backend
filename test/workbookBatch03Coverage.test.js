import assert from 'node:assert/strict'
import test from 'node:test'

import dedicatedProviders from '../scraper-support/providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const manifest = {
  companies: dedicatedProviders
    .filter((provider) => String(provider.originalModulePath || '').startsWith('../workbookbatch03/'))
    .map((provider) => provider.companyName),
}
const providersBySource = new Map(dedicatedProviders.map((provider) => [provider.source, provider]))

test('Workbook batch 03 companies all resolve to dedicated providers', () => {
  const report = generateCompanyCoverageReport({
    csvText: ['company_name', ...manifest.companies].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, manifest.companies.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
  assert.deepEqual(report.matched.map(({ companyName }) => companyName), manifest.companies)
  assert.ok(report.matched.every(({ source }) => providersBySource.has(source)))
})
