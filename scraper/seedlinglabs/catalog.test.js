import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Seedling Labs is registered against its verified first-party careers route', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'seedlinglabs')

  assert.ok(provider, 'Expected Seedling Labs provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Seedling Labs')
  assert.equal(provider.companyCareerPage, 'https://seedlinglabs.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-spa-shell-plus-first-party-client-bundle',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-site-shell+verified-careers-route+verified-client-bundle+inline-open-roles-array+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'seedlinglabs.com')
  assert.match(provider.modulePath, /seedlinglabs[\\/]script\.js$/i)
})

test('Seedling Labs matches CSV coverage from provider metadata and official brand alias, and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Seedling Labs,\nSeedlingLabs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Seedling Labs', 'seedlinglabs', 'Seedling Labs'],
      ['SeedlingLabs', 'seedlinglabs', 'Seedling Labs'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'seedlinglabs')

  assert.ok(scraper, 'Expected buildScrapers() to return the Seedling Labs scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'seedlinglabs')
  assert.equal(scraper.provider.companyCareerPage, 'https://seedlinglabs.com/careers')
  assert.match(scraper.dryRunFile, /seedlinglabs[\\/]jobs\.json$/i)
})
