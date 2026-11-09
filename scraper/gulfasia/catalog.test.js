import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Gulf Asia is registered as a verified parked-domain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gulfasia')

  assert.ok(provider, 'Expected Gulf Asia provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gulf Asia')
  assert.equal(provider.companyCareerPage, 'https://www.gulfasia.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'United Arab Emirates')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-and-jobs-parked-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-parked-homepage+verified-parked-careers-and-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'gulfasia.com')
  assert.match(provider.modulePath, /gulfasia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Gulf Asia'), false)
})

test('Gulf Asia matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Gulf Asia\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Gulf Asia', 'gulfasia', 'Gulf Asia']],
  )
})

test('Gulf Asia is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gulfasia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Gulf Asia scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gulfasia')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.gulfasia.com/')
  assert.match(scraper.dryRunFile, /gulfasia[\\/]jobs\.json$/i)
})
