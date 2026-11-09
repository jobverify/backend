import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Stellantis as a public search-api script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stellantis')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Stellantis')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.stellantis.com/job-search-results/')
  assert.equal(provider.baseUrl, 'https://jobsapi-google.m-cloud.io/api/job/search')
  assert.equal(provider.atsPlatform, 'findly-xcloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-token-query')
  assert.equal(
    provider.extractionStrategy,
    'public-job-search-api+india-location-filter+feed-apply-url',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /stellantis[\\/]script\.js$/i)
  assert.equal(provider.companyDomain, 'careers.stellantis.com')
})

test('buildScrapers and company coverage resolve Stellantis to the stellantis source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'stellantis')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /stellantis[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'stellantis')

  const report = generateCompanyCoverageReport({
    csvText: 'Stellantis,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Stellantis', 'stellantis', 'Stellantis']],
  )
})
