import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('ION EXCHANGE ZERO B is registered with current own regional sales cohort observations without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ionexchangezerob')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'ION EXCHANGE ZERO B')
  assert.equal(provider.companyCareerPage, 'https://www.zerobonline.com/careers/')
  assert.equal(provider.atsPlatform, 'official-current-zerob-regional-sales-role-areas-unqualified')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'active-own-careers-listing-and-regional-cohort-detail-models-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'whole-native-regional-sales-cohort-criteria+role-area-observations+distinct-requisition-country-application-and-company-scope-held',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'zerobonline.com')
  assert.match(provider.modulePath, /ionexchangezerob[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ION EXCHANGE ZERO B'), false)
})

test('ION EXCHANGE ZERO B matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ION EXCHANGE ZERO B,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ION EXCHANGE ZERO B', 'ionexchangezerob', 'ION EXCHANGE ZERO B']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ionexchangezerob')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ionexchangezerob')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.zerobonline.com/careers/')
  assert.match(scraper.dryRunFile, /ionexchangezerob[\\/]jobs\.json$/i)
})
