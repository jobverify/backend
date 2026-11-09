import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Jumbotail as an official careers page plus detail-page scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jumbotail')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Jumbotail')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://jumbotail.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-listing-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'official-careers-page+html-job-cards+detail-pages+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jumbotail.com')
  assert.match(provider.modulePath, /jumbotail[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Jumbotail to the jumbotail source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jumbotail')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /jumbotail[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'jumbotail')

  const report = generateCompanyCoverageReport({
    csvText: 'Jumbotail,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jumbotail', 'jumbotail', 'Jumbotail']],
  )
})
