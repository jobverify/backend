import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Legion Energy Products pvt ltd. is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'legionenergyproductspvtltd')

  assert.ok(provider, 'Expected Legion Energy Products pvt ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Legion Energy Products pvt ltd.')
  assert.equal(provider.companyCareerPage, 'https://legionenergy.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-common-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-email-only-careers-page+verified-culture-cards+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'legionenergy.in')
  assert.match(provider.modulePath, /legionenergyproductspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Legion Energy Products pvt ltd.'), false)
})

test('Legion Energy Products pvt ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Legion Energy Products pvt ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Legion Energy Products pvt ltd.', 'legionenergyproductspvtltd', 'Legion Energy Products pvt ltd.']],
  )
})

test('Legion Energy Products pvt ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'legionenergyproductspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Legion Energy Products pvt ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'legionenergyproductspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://legionenergy.in/careers/')
  assert.match(scraper.dryRunFile, /legionenergyproductspvtltd[\\/]jobs\.json$/i)
})
