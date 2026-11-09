import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Merck as a Phenom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'merck')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Merck')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://careers.merckgroup.com/global/en/search-results')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'embedded-json+detail-page')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.merckgroup.com')
  assert.match(provider.modulePath, /merck[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Merck to the merck source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'merck')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /merck[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'merck')

  const report = generateCompanyCoverageReport({
    csvText: 'Merck,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Merck', 'merck', 'Merck']],
  )
})
