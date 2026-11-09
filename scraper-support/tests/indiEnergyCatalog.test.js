import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Indi Energy is registered against the verified official apply-only careers shell without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indienergy')

  assert.ok(provider, 'Expected Indi Energy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'INDI ENERGY')
  assert.equal(provider.companyCareerPage, 'https://indienergy.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-rebuilt-spa-shell',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-spa-homepage+verified-careers-route-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'indienergy.in')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Desh Ki Battery/i)
  assert.match(provider.verifiedSurfaceSummary, /Send enquiry/i)
  assert.match(provider.modulePath, /indienergy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'INDI ENERGY'), false)
})

test('Indi Energy matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'INDI ENERGY,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['INDI ENERGY', 'indienergy', 'INDI ENERGY']],
  )
})

test('Indi Energy is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indienergy')

  assert.ok(scraper, 'Expected buildScrapers() to return the Indi Energy scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indienergy')
  assert.equal(scraper.provider.companyCareerPage, 'https://indienergy.in/careers/')
  assert.match(scraper.dryRunFile, /indienergy[\\/]jobs\.json$/i)
})
