import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('BASEEL is registered as a verified dual-domain first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'baseel')

  assert.ok(provider, 'Expected BASEEL provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'BASEEL')
  assert.equal(provider.companyCareerPage, 'https://baseel.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'dual-homepages-plus-sitemaps-plus-route-fallbacks-plus-client-bundle-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-dual-homepages+shared-contact+verified-sitemaps-without-careers+verified-route-shell-fallbacks+verified-client-bundles-without-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'baseel.com')
  assert.match(provider.modulePath, /baseel[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'BASEEL'), false)
})

test('BASEEL matches company coverage directly from provider metadata for the exact CSV company name', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'BASEEL,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BASEEL', 'baseel', 'BASEEL']],
  )
})

test('buildScrapers exposes a runnable BASEEL sentinel without changing the scraper runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'baseel')

  assert.ok(scraper, 'Expected buildScrapers() to return the BASEEL sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'baseel')
  assert.equal(scraper.provider.companyCareerPage, 'https://baseel.com/')
  assert.match(scraper.dryRunFile, /baseel[\\/]jobs\.json$/i)
})
