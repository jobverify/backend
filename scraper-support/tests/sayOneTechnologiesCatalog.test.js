import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('SayOne Technologies is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sayonetechnologies')

  assert.ok(provider, 'Expected SayOne Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SayOne Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.sayonetech.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-public-strapi-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-strapi-job-postings-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sayonetech.com')
  assert.match(provider.modulePath, /sayonetechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SayOne Technologies'), false)
})

test('SayOne Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SayOne Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SayOne Technologies', 'sayonetechnologies', 'SayOne Technologies']],
  )
})

test('SayOne Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sayonetechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the SayOne Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sayonetechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sayonetech.com/career/')
  assert.match(scraper.dryRunFile, /sayonetechnologies[\\/]jobs\.json$/i)
})
