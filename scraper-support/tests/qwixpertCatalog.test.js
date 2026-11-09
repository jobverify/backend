import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Qwixpert is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'qwixpert')

  assert.ok(provider, 'Expected Qwixpert provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Qwixpert')
  assert.equal(provider.companyCareerPage, 'https://qwixpert.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-index-plus-page-sitemap-plus-common-careers-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-sitemap-index-and-page-sitemap-without-careers+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'qwixpert.com')
  assert.match(provider.modulePath, /qwixpert[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Qwixpert'), false)
})

test('Qwixpert resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Qwixpert,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Qwixpert', 'qwixpert', 'Qwixpert']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'qwixpert')

  assert.ok(scraper, 'Expected buildScrapers() to return the Qwixpert sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'qwixpert')
  assert.equal(scraper.provider.companyCareerPage, 'https://qwixpert.com/')
  assert.match(scraper.dryRunFile, /qwixpert[\\/]jobs\.json$/i)
})
