import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mars as a Phenom script provider with the verified public careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mars')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Mars')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.mars.com/global/en/search-results')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'embedded-json+detail-pages+workday-apply-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.mars.com')
  assert.match(provider.modulePath, /mars[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Mars to the mars source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mars')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mars[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'mars')

  const report = generateCompanyCoverageReport({
    csvText: 'Mars,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mars', 'mars', 'Mars']],
  )
})
