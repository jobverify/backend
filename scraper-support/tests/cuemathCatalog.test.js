import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('registers Cuemath as an official tutor-application source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'cuemath')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Cuemath')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-tutor-screening-with-unqualified-vacancy-inventory')
  assert.equal(provider.companyCareerPage, 'https://tutorhiring.cuemath.com/')
  assert.equal(provider.companyDomain, 'tutorhiring.cuemath.com')
  assert.equal(provider.paginationStrategy, 'exact-owned-redirect-and-whole-native-screening-model-opening-closing-reconciliation')
  assert.equal(provider.extractionStrategy, 'current-first-party-tutor-screening+whole-native-public-intake-config-and-client+inventory-unavailable-hold')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /cuemath[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'cuemath')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves the Cuemath brand to the Cuemath source', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Cuemath,,
`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Cuemath', 'cuemath'],
  ])
})
