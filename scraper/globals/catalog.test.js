import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Globals is registered through the custom provider catalog without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'globals')

  assert.ok(provider, 'Expected Globals provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Globals')
  assert.equal(provider.companyCareerPage, 'https://www.globalsinc.com/careers/current-openings/')
  assert.equal(provider.atsPlatform, 'zoho-recruit-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-zoho-public-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-current-openings-page+zoho-public-api+detail-page-check',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'globalsinc.com')
  assert.match(provider.modulePath, /globals[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Globals'), false)
})

test('Globals matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Globals\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Globals', 'globals', 'Globals']],
  )
})

test('Globals is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'globals')

  assert.ok(scraper, 'Expected buildScrapers() to return the Globals scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'globals')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.globalsinc.com/careers/current-openings/')
  assert.match(scraper.dryRunFile, /globals[\\/]jobs\.json$/i)
})
