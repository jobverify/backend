import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Alpha Techno Solutions is registered as a verified first-party zero-public-jobs sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alphatechnosolutions')

  assert.ok(provider, 'Expected Alpha Techno Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Alpha Techno Solutions')
  assert.equal(provider.companyCareerPage, 'https://alphatechno.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-page-sitemap-plus-contact-plus-missing-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-page-sitemap+verified-contact-page+verified-missing-careers-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'alphatechno.in')
  assert.match(provider.modulePath, /alphatechnosolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Alpha Techno Solutions'), false)
})

test('Alpha Techno Solutions matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Alpha Techno Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alpha Techno Solutions', 'alphatechnosolutions', 'Alpha Techno Solutions']],
  )
})

test('Alpha Techno Solutions is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'alphatechnosolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Alpha Techno Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'alphatechnosolutions')
  assert.equal(scraper.provider.companyCareerPage, 'https://alphatechno.in/')
  assert.match(scraper.dryRunFile, /alphatechnosolutions[\\/]jobs\.json$/i)
})
