import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Morphle Labs is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'morphlelabs')

  assert.ok(provider, 'Expected Morphle Labs provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Morphle Labs')
  assert.equal(provider.companyCareerPage, 'https://morphlelabs.com/about-us')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-page-plus-sitemap-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-about-page-hiring-contact+verified-sitemap-without-career-routes+verified-stale-evaluation-route+verified-missing-public-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'morphlelabs.com')
  assert.match(provider.modulePath, /morphlelabs[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Morphle Labs'), false)
})

test('Morphle Labs matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Morphle Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Morphle Labs', 'morphlelabs', 'Morphle Labs']],
  )
})

test('Morphle Labs is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'morphlelabs')

  assert.ok(scraper, 'Expected buildScrapers() to return the Morphle Labs scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'morphlelabs')
  assert.equal(scraper.provider.companyCareerPage, 'https://morphlelabs.com/about-us')
  assert.match(scraper.dryRunFile, /morphlelabs[\\/]jobs\.json$/i)
})
