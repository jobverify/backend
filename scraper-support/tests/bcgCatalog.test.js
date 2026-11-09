import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BCG on the official Phenom search board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bcg')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BCG')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://careers.bcg.com/global/en/search-results')
  assert.equal(provider.companyDomain, 'careers.bcg.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'embedded-json-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'phenom-search+detail-enrichment')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bcg[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BCG without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bcg')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bcg[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bcg')

  const report = generateCompanyCoverageReport({
    csvText: 'BCG,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
