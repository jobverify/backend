import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Quinbay Technologies is registered as a verified parked-lander sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'quinbay')

  assert.ok(provider, 'Expected Quinbay provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Quinbay Technologies')
  assert.equal(provider.companyCareerPage, 'https://quinbay.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-careers-jobs-and-sitemap-lander-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-route+verified-jobs-route+verified-sitemap+verified-parked-lander-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'quinbay.com')
  assert.match(provider.modulePath, /quinbay[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Quinbay Technologies'), false)
})

test('Quinbay resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Quinbay Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Quinbay Technologies', 'quinbay', 'Quinbay Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'quinbay')

  assert.ok(scraper, 'Expected buildScrapers() to return the Quinbay sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'quinbay')
  assert.equal(scraper.provider.companyCareerPage, 'https://quinbay.com/careers/')
  assert.match(scraper.dryRunFile, /quinbay[\\/]jobs\.json$/i)
})
