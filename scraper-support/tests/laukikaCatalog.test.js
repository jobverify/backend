import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Laukika is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'laukika')

  assert.ok(provider, 'Expected Laukika provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Laukika Consultancy Solutions Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.laukika.com/know-our-brand/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-brand-hiring-page-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-brand-hiring-page+verified-common-careers-routes-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'laukika.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Verified on Friday, August 7, 2026/i)
  assert.match(provider.modulePath, /laukika[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Laukika Consultancy Solutions Private Limited'),
    false,
  )
})

test('Laukika matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Laukika Consultancy Solutions Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Laukika Consultancy Solutions Private Limited',
      'laukika',
      'Laukika Consultancy Solutions Private Limited',
    ]],
  )
})

test('Laukika is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'laukika')

  assert.ok(scraper, 'Expected buildScrapers() to return the Laukika scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'laukika')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.laukika.com/know-our-brand/')
  assert.match(scraper.dryRunFile, /laukika[\\/]jobs\.json$/i)
})
