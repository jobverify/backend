import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Mode is registered as an exact-name first-party sentinel against the live Mode careers redirect surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mode')

  assert.ok(provider, 'Expected Mode provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Mode')
  assert.equal(provider.companyCareerPage, 'https://mode.com/careers')
  assert.equal(provider.companyDomain, 'mode.com')
  assert.equal(provider.modeAcquisitionPressUrl, 'https://mode.com/press/thoughtspot-acquires-mode/')
  assert.equal(
    provider.thoughtspotAcquisitionPressUrl,
    'https://www.thoughtspot.com/press-releases/thoughtspot-completes-200m-acquisition-of-mode-analytics',
  )
  assert.equal(provider.atsPlatform, 'no-standalone-mode-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-redirect-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-mode-careers-route-now-renders-thoughtspot-careers-without-standalone-mode-openings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /mode[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mode[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mode\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /ThoughtSpot/i)
  assert.match(provider.verifiedSurfaceSummary, /no standalone public Mode jobs surface/i)
})

test('Mode matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nMode\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mode', 'mode', 'Mode']],
  )
})

test('Mode is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mode')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mode')
  assert.match(scraper.dryRunFile, /mode[\\/]jobs\.json$/i)
})
