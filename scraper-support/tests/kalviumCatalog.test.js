import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Kalvium as an official-linked PyjamaHR script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kalvium')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Kalvium')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://app.pyjamahr.com/careers?company=Kalvium&company_uuid=DBE8CE5737')
  assert.equal(provider.atsPlatform, 'pyjamahr')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query-public-api-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'official-homepage-handoff+pyjamahr-public-api+job-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kalvium.com')
  assert.match(provider.modulePath, /kalvium[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Kalvium to the kalvium source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kalvium')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /kalvium[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'kalvium')

  const report = generateCompanyCoverageReport({
    csvText: 'Kalvium,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kalvium', 'kalvium', 'Kalvium']],
  )
})
