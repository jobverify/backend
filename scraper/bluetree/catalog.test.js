import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Blue Tree is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bluetree')

  assert.ok(provider, 'Expected Blue Tree provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Blue Tree')
  assert.equal(provider.companyCareerPage, 'https://www.getbluetree.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-contact-and-sitemap-validation-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-contact-page+verified-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'getbluetree.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /external workforce & labour management/i)
  assert.match(provider.modulePath, /bluetree[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Blue Tree'), false)
})

test('Blue Tree resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Blue Tree,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Blue Tree', 'bluetree', 'Blue Tree']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'bluetree')

  assert.ok(scraper, 'Expected buildScrapers() to return the Blue Tree sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bluetree')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.getbluetree.com/')
  assert.match(scraper.dryRunFile, /bluetree[\\/]jobs\.json$/i)
})
