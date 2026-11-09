import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes WSP India as an official WSP handoff scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wspindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'WSP India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://www.wsp.com/en-gl/sites/india')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-jobs-page-pagination')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-advertised-Oracle-requisitions+typed-native-India-countries+own-employer-statements+all-public-native-criteria+native-publication-dates',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'wsp.com')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicJobCount, 491)
  assert.equal(provider.verifiedIndiaJobCount, 491)
  assert.match(provider.verifiedSurfaceSummary, /504 published India rows across 26 pages.*491 distinct Oracle requisition IDs/i)
  assert.match(provider.modulePath, /wspindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact CSV company name WSP India without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'wspindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /wspindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'wspindia')

  const report = generateCompanyCoverageReport({
    csvText: 'WSP India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['WSP India', 'wspindia', 'WSP India']],
  )
})
