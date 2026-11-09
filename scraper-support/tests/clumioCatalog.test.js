import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Clumio as a discovery-only Commvault-backed corporate and native source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'clumio')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Clumio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://www.commvault.com/careers/jobs')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'paired-current-corporate-and-native-public-GETs')
  assert.equal(provider.extractionStrategy, 'all-original-corporate-native-roles-before-brand-and-country-selection')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'commvault.com')
  assert.equal(provider.verifiedInventoryStatus, 'unverified')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.modulePath, /clumio[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Clumio rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'clumio')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /clumio[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'clumio')

  const report = generateCompanyCoverageReport({
    csvText: 'Clumio,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Clumio', 'clumio', 'Clumio']],
  )
})
