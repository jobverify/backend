import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Chakra Ventures is registered as a verified parked-domain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chakraventures')

  assert.ok(provider, 'Expected Chakra Ventures provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Chakra Ventures')
  assert.equal(provider.companyCareerPage, 'https://chakraventures.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-jobs-and-lander-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-timeout-only-first-party-routes+legacy-redirect-shell-and-parked-lander-fallback-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'chakraventures.com')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /repeated connect timeouts/i)
  assert.match(provider.modulePath, /chakraventures[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Chakra Ventures'), false)
})

test('Chakra Ventures matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Chakra Ventures,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Chakra Ventures', 'chakraventures', 'Chakra Ventures']],
  )
})

test('Chakra Ventures is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chakraventures')

  assert.ok(scraper, 'Expected buildScrapers() to return the Chakra Ventures scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'chakraventures')
  assert.equal(scraper.provider.companyCareerPage, 'https://chakraventures.com/')
  assert.match(scraper.dryRunFile, /chakraventures[\\/]jobs\.json$/i)
})
