import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes ClearTax as a Darwinbox script provider with verified official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cleartax')

  assert.ok(provider)
  assert.equal(provider.companyName, 'ClearTax')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.clear.in/s/careers')
  assert.equal(provider.companyDomain, 'clear.in')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://clear.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(provider.extractionStrategy, 'verified-official-handoff+complete-public-darwinbox-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /cleartax[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve ClearTax to cleartax', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cleartax')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cleartax[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'cleartax')

  const report = generateCompanyCoverageReport({
    csvText: 'ClearTax,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ClearTax', 'cleartax', 'ClearTax']],
  )
})
