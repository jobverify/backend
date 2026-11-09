import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Relevance Lab as a first-party script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'relevancelab')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Relevance Lab')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'relevancelab-first-party')
  assert.equal(provider.companyCareerPage, 'https://www.relevancelab.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'html-section-listing-plus-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'relevancelab.com')
  assert.match(provider.modulePath, /relevancelab[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Relevance Lab to the exact company source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'relevancelab')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /relevancelab[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'relevancelab')

  const report = generateCompanyCoverageReport({
    csvText: 'Relevance Lab,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Relevance Lab', 'relevancelab', 'Relevance Lab']],
  )
})
