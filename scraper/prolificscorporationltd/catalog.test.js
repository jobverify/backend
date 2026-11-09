import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Prolifics Corporation Ltd is registered against the verified first-party Prolifics careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prolificscorporationltd')

  assert.ok(provider, 'Expected Prolifics Corporation Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Prolifics Corporation Private Limited')
  assert.equal(provider.companyCareerPage, 'https://prolifics.ai/careers')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-handoff+single-public-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+verified-zoho-portal+public-recruit-json+india-filter+test-listing-rejection',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'prolifics.ai')
  assert.match(provider.modulePath, /prolificscorporationltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Prolifics Corporation Ltd'), false)
})

test('Prolifics Corporation Ltd matches coverage through normalization and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Prolifics Corporation Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Prolifics Corporation Ltd', 'prolificscorporationltd', 'Prolifics Corporation Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'prolificscorporationltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Prolifics Corporation Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'prolificscorporationltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://prolifics.ai/careers')
  assert.match(scraper.dryRunFile, /prolificscorporationltd[\\/]jobs\.json$/i)
})
