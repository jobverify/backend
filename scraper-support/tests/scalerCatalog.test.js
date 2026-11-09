import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Scaler as an official careers scraper with verified metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'scaler')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Scaler')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.scaler.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-listing-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+same-domain-opening-links+detail-pages+external-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'scaler.com')
  assert.match(provider.modulePath, /scaler[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Scaler without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'scaler')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /scaler[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'scaler')

  const report = generateCompanyCoverageReport({
    csvText: 'Scaler,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Scaler', 'scaler', 'Scaler']],
  )
})
