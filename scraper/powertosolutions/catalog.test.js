import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'powertosolutions'
const COMPANY = 'Power to Solutions'

test('Power to Solutions is registered as a search-backed absent-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Power to Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, null)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://powertosolutions.com/',
    'https://powertosolutions.in/',
    'https://powertosolutions.co.in/',
    'https://power2solutions.com/',
    'https://www.bing.com/search?format=rss&q=%22Power+to+Solutions%22',
    'https://www.bing.com/search?format=rss&q=%22Power+to+Solutions%22+careers',
  ])
  assert.equal(provider.atsPlatform, 'search-sentinel-no-public-company-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-domain-resolution-plus-bing-rss-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-candidates+verified-company-and-careers-search-feeds-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, null)
  assert.match(provider.modulePath, /powertosolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Power to Solutions resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Power to Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, null)
  assert.match(scraper.dryRunFile, /powertosolutions[\\/]jobs\.json$/i)
})
