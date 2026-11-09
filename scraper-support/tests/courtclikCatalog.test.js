import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Courtclik is registered as a verified first-party careers API scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'courtclik')

  assert.ok(provider, 'Expected Courtclik provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Courtclik')
  assert.equal(provider.companyCareerPage, 'https://www.courtclick.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-complete-first-party-careers-api-array')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+complete-careers-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'courtclick.com')
  assert.match(provider.modulePath, /courtclik[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Courtclik'), false)
})

test('Courtclik matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Courtclik,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Courtclik', 'courtclik', 'Courtclik']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'courtclik')

  assert.ok(scraper, 'Expected buildScrapers() to return the Courtclik scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'courtclik')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.courtclick.com/career')
  assert.match(scraper.dryRunFile, /courtclik[\\/]jobs\.json$/i)
})
