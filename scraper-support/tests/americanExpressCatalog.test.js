import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes American Express as an Oracle Cloud-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'americanexpress')

  assert.ok(provider)
  assert.equal(provider.companyName, 'American Express')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://careers.americanexpress.com/en/sites/CX_1/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'oracle-cloud-finder-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.scraperTimeoutMs, 1200000)
  assert.equal(provider.companyDomain, 'careers.americanexpress.com')
  assert.match(provider.modulePath, /americanexpress[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve American Express to the americanexpress source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'americanexpress')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /americanexpress[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'americanexpress')
  assert.equal(scraper.provider.scraperTimeoutMs, 1200000)

  const report = generateCompanyCoverageReport({
    csvText: 'American Express,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['American Express', 'americanexpress', 'American Express']],
  )
})
