import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BigBasket as a Darwinbox script provider with verified official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bigbasket')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BigBasket')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://careers.bigbasket.com/')
  assert.equal(provider.companyDomain, 'careers.bigbasket.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(provider.extractionStrategy, 'verified-official-handoff+complete-public-darwinbox-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://bigbasket.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.match(provider.modulePath, /bigbasket[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BigBasket to bigbasket', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bigbasket')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bigbasket[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bigbasket')

  const report = generateCompanyCoverageReport({
    csvText: 'BigBasket,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BigBasket', 'bigbasket', 'BigBasket']],
  )
})
