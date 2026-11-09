import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Win Research Centre is registered as a verified first-party non-listing sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'winresearchcentre')

  assert.ok(provider, 'Expected Win Research Centre provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Win Research Centre')
  assert.equal(provider.companyCareerPage, 'https://www.winresearchcentre.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-contact-sitemap-and-missing-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers+verified-contact+verified-sitemap+verified-missing-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'winresearchcentre.in')
  assert.match(provider.modulePath, /winresearchcentre[\\/]script\.js$/i)
})

test('Win Research Centre matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Win Research Centre\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Win Research Centre', 'winresearchcentre', 'Win Research Centre']],
  )
})

test('Win Research Centre is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'winresearchcentre')

  assert.ok(scraper, 'Expected buildScrapers() to return the Win Research Centre sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'winresearchcentre')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.winresearchcentre.in/careers')
  assert.match(scraper.dryRunFile, /winresearchcentre[\\/]jobs\.json$/i)
})
