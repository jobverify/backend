import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes NPCI as an embedded Zoho careers-page script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'npci')

  assert.ok(provider)
  assert.equal(provider.companyName, 'National Payments Corporation of India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyCareerPage, 'https://careers.npci.org.in/jobs/Careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-board-api-full-array-and-closing-reconciliation')
  assert.equal(provider.extractionStrategy, 'exact-first-party-organization+native-NPCI-entity+india-city-state+full-record-descriptions')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'npci.org.in')
  assert.match(provider.modulePath, /npci[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve NPCI to the npci source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'npci')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /npci[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'npci')

  const report = generateCompanyCoverageReport({
    csvText: 'National Payments Corporation Of India (NPCI),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['National Payments Corporation Of India (NPCI)', 'npci', 'National Payments Corporation of India']],
  )
})
