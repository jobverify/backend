import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Novac Technology Solutions is registered against the official careers shell', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'novactechnologysolutions')

  assert.ok(provider, 'Expected Novac Technology Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Novac Technology Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.novactech.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell-zero-public-job-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'novactech.com')
  assert.match(provider.modulePath, /novactechnologysolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Novac Technology Solutions'), false)
})

test('Novac Technology Solutions matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Novac Technology Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Novac Technology Solutions', 'novactechnologysolutions'],
  ])
})

test('Novac Technology Solutions is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'novactechnologysolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Novac Technology Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'novactechnologysolutions')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.novactech.com/careers')
  assert.match(scraper.dryRunFile, /novactechnologysolutions[\\/]jobs\.json$/i)
})
