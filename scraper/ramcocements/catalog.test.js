import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('The Ramco Cements Limited is registered as a verified first-party no-public-listings sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ramcocements')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'The Ramco Cements Limited')
  assert.equal(provider.companyCareerPage, 'https://www.ramcocements.in/about/life-at-ramco')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-life-page-and-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-life-page+missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ramcocements.in')
  assert.match(provider.modulePath, /ramcocements[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'The Ramco Cements Limited'), false)
})

test('The Ramco Cements Limited resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'The Ramco Cements Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['The Ramco Cements Limited', 'ramcocements', 'The Ramco Cements Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ramcocements')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ramcocements')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ramcocements.in/about/life-at-ramco')
  assert.match(scraper.dryRunFile, /ramcocements[\\/]jobs\.json$/i)
})
