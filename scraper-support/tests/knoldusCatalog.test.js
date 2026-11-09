import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Knoldus Inc is registered as a verified legacy-domain redirect scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'knoldus')

  assert.ok(provider, 'Expected Knoldus provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Knoldus Inc')
  assert.equal(provider.companyCareerPage, 'https://www.nashtechglobal.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legacy-domain-redirect-plus-first-party-careers-handoff-plus-reactpress-public-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-knoldus-domain-redirect+verified-nashtech-homepage+verified-careers-handoff+verified-jobs-finder-reactpress-bundle+first-party-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nashtechglobal.com')
  assert.match(provider.modulePath, /knoldus[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Knoldus Inc'), false)
})

test('Knoldus Inc matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Knoldus Inc,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Knoldus Inc', 'knoldus', 'Knoldus Inc']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'knoldus')

  assert.ok(scraper, 'Expected buildScrapers() to return the Knoldus scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'knoldus')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.nashtechglobal.com/careers/')
  assert.match(scraper.dryRunFile, /knoldus[\\/]jobs\.json$/i)
})
