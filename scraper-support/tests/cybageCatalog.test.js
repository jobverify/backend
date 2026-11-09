import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cybage as a verified first-party jobs table source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cybage')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Cybage')
  assert.equal(provider.companyCareerPage, 'https://www.cybage.com/careers/open-positions')
  assert.equal(provider.atsPlatform, 'official-company-careers-aspnet-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-table-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-table+detail-pages+aspnet-login-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cybage.com')
  assert.match(provider.modulePath, /cybage[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Cybage rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cybage')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cybage')
  assert.match(scraper.dryRunFile, /cybage[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Cybage,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cybage', 'cybage', 'Cybage']],
  )
})
