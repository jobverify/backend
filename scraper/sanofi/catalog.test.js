import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Sanofi is registered as an exact-name first-party provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sanofi')

  assert.ok(provider, 'Expected Sanofi provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sanofi')
  assert.equal(provider.companyCareerPage, 'https://jobs.sanofi.com/en/india')
  assert.equal(provider.atsPlatform, 'radancy')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'country-search-path-segment-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-india-page+verified-country-search-pages+detail-jsonld',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.sanofi.com')
  assert.match(provider.modulePath, /sanofi[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sanofi'), false)
})

test('Sanofi matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sanofi,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sanofi', 'sanofi', 'Sanofi']],
  )
})

test('Sanofi is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sanofi')

  assert.ok(scraper, 'Expected buildScrapers() to return the Sanofi scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sanofi')
  assert.equal(scraper.provider.companyCareerPage, 'https://jobs.sanofi.com/en/india')
  assert.match(scraper.dryRunFile, /sanofi[\\/]jobs\.json$/i)
})
