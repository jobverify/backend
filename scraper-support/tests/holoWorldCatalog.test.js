import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('HoloWorld is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'holoworld')

  assert.ok(provider, 'Expected HoloWorld provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HoloWorld')
  assert.equal(provider.companyCareerPage, 'https://holoworld.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'holoworld.com')
  assert.match(provider.modulePath, /holoworld[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'HoloWorld'), false)
})

test('HoloWorld matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'HoloWorld,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HoloWorld', 'holoworld', 'HoloWorld']],
  )
})

test('HoloWorld is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'holoworld')

  assert.ok(scraper, 'Expected buildScrapers() to return the HoloWorld scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'holoworld')
  assert.equal(scraper.provider.companyCareerPage, 'https://holoworld.com/')
  assert.match(scraper.dryRunFile, /holoworld[\\/]jobs\.json$/i)
})
