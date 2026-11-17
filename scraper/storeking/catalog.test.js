import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Store King is registered as a verified first-party no-public-careers sentinel with safe whitespace alias coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'storeking')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'StoreKing')
  assert.equal(provider.companyCareerPage, 'https://storeking.in/careers')
  assert.equal(provider.atsPlatform, 'current-own-native-client-role-dtos-and-application-programme')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'own-home-declared-careers-inside-sales-and-complete-pinned-native-role-programme-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'whole-seven-current-native-role-dtos-criteria-and-application-programme+protected-contact-raw-model-retained+role-country-browser-application-and-company-scope-held',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'storeking.in')
  assert.match(provider.modulePath, /storeking[\\/]script\.js$/i)
  assert.equal(companyAliases['Store King'], 'storeking')
})

test('Store King resolves through alias coverage and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Store King,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Store King', 'storeking', 'StoreKing']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'storeking')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'storeking')
  assert.equal(scraper.provider.companyCareerPage, 'https://storeking.in/careers')
  assert.match(scraper.dryRunFile, /storeking[\\/]jobs\.json$/i)
})
