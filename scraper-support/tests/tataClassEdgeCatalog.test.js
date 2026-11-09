import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tata ClassEdge as a custom script provider on the official first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tataclassedge')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tata ClassEdge')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.tataclassedge.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-openings-page-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'elementor-loop-cards+same-domain-detail-pages+inline-apply-form')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tataclassedge.com')
  assert.match(provider.modulePath, /tataclassedge[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve TATA Classedge without requiring a company alias', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tataclassedge')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tataclassedge[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tataclassedge')

  const report = generateCompanyCoverageReport({
    csvText: 'TATA Classedge,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TATA Classedge', 'tataclassedge', 'Tata ClassEdge']],
  )
})
