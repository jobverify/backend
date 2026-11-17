import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('DRYTIS is registered as a verified first-party no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'drytis')

  assert.ok(provider, 'Expected DRYTIS provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'DRYTIS')
  assert.equal(provider.companyCareerPage, 'https://drytis.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-with-unqualified-native-inventory')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'current-declared-careers-and-whole-own-programme-opening-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-careers-and-own-programmes+literal-advertised-empty-newsletter+unknown-company-inventory-hold',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'drytis.com')
  assert.match(provider.modulePath, /drytis[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DRYTIS'), false)
})

test('DRYTIS resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'DRYTIS,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DRYTIS', 'drytis', 'DRYTIS']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'drytis')

  assert.ok(scraper, 'Expected buildScrapers() to return the DRYTIS sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'drytis')
  assert.equal(scraper.provider.companyCareerPage, 'https://drytis.com/careers/')
  assert.match(scraper.dryRunFile, /drytis[\\/]jobs\.json$/i)
})
