import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Brysa is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'brysa')

  assert.ok(provider, 'Expected Brysa provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Brysa')
  assert.equal(provider.companyCareerPage, 'https://brysa.ai/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-contact-sitemap-validation-plus-common-careers-404-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about+verified-contact+verified-join-team-contact-handoff+verified-sitemap-without-careers+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'brysa.ai')
  assert.match(provider.modulePath, /brysa[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Brysa'), false)
})

test('Brysa resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'brysa,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['brysa', 'brysa', 'Brysa']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'brysa')

  assert.ok(scraper, 'Expected buildScrapers() to return the Brysa sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'brysa')
  assert.equal(scraper.provider.companyCareerPage, 'https://brysa.ai/')
  assert.match(scraper.dryRunFile, /brysa[\\/]jobs\.json$/i)
})
