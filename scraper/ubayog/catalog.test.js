import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Ubayog is registered as a verified first-party no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ubayog')

  assert.ok(provider, 'Expected Ubayog provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ubayog')
  assert.equal(provider.companyCareerPage, 'https://ubayog.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-contact-and-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-about-page+verified-contact-page+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ubayog.com')
  assert.match(provider.modulePath, /ubayog[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ubayog'), false)
})

test('Ubayog resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ubayog,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ubayog', 'ubayog', 'Ubayog']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ubayog')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ubayog sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ubayog')
  assert.equal(scraper.provider.companyCareerPage, 'https://ubayog.com/')
  assert.match(scraper.dryRunFile, /ubayog[\\/]jobs\.json$/i)
})
