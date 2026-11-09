import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the current declared Cashfree public Kula board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cashfreepayments')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Cashfree Payments')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'kula-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.cashfree.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'all-public-api-pages+rendered-board+closing-full-native-models')
  assert.equal(provider.extractionStrategy, 'current-official-iframe+account1291+same-ID-full-public-criteria+typed-worksite-country')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cashfree.com')
  assert.match(provider.modulePath, /cashfreepayments[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Cashfree Payments to cashfreepayments', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cashfreepayments')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cashfreepayments[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'cashfreepayments')

  const report = generateCompanyCoverageReport({
    csvText: 'Cashfree Payments,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cashfree Payments', 'cashfreepayments', 'Cashfree Payments']],
  )
})
