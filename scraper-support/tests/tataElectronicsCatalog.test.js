import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Tata Electronics catalog exposes native public discovery while retaining incomplete source scope', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tataelectronics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'TATA Electronics Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors-public-native-get')
  assert.equal(provider.companyCareerPage, 'https://www.tataelectronics.com/work-with-us')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'corporate-published-native-public-get')
  assert.equal(provider.extractionStrategy, 'all-country-native-listings-and-complete-own-models-before-caps')
  assert.equal(provider.parser, 'tataelectronics-native-public-get')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tataelectronics.com')
  assert.equal(provider.backfillMode, 'discovery-only')
  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.verifiedInventoryStatus, 'unverified')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.match(provider.modulePath, /tataelectronics[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Tata Electronics Pvt Ltd to the tataelectronics source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tataelectronics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tataelectronics[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tataelectronics')

  const report = generateCompanyCoverageReport({
    csvText: 'Tata Electronics Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tata Electronics Pvt Ltd', 'tataelectronics', 'TATA Electronics Private Limited']],
  )
})
