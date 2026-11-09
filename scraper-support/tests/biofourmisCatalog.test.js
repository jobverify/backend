import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Biofourmis on the official careers page backed by Greenhouse', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'biofourmis')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Biofourmis')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://biofourmis.com/about/job-openings')
  assert.equal(provider.companyDomain, 'biofourmis.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'full-native-post-feed-and-office-index;all-native-post-GETs-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'all-published-original-post-models-and-complete-criteria-before-prospect-country-selection',
  )
  assert.equal(provider.parser, 'current-declared-native-post-models')
  assert.match(provider.modulePath, /biofourmis[\\/]script\.js$/i)
  assert.equal(provider.publicInventoryVerification.policy, 'biofourmis-current-advertised-public-source')
  assert.equal(provider.publicInventoryVerification.currentDisposition, 'coverage-gap')
  assert.equal(provider.publicInventoryVerification.companyGlobalTotal, null)
  assert.equal(provider.publicInventoryVerification.wholeCompanyScope, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})

test('buildScrapers and company coverage resolve Biofourmis without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'biofourmis')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /biofourmis[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'biofourmis')

  const report = generateCompanyCoverageReport({
    csvText: 'Biofourmis,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
