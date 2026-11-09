import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Godhar Infratech Pvt ltd is registered as an unresolved-host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'godharinfratechpvtltd')

  assert.ok(provider, 'Expected Godhar Infratech Pvt ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Godhar Infratech Pvt ltd')
  assert.equal(provider.companyCareerPage, 'https://godharinfratech.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'godharinfratech.com')
  assert.match(provider.modulePath, /godharinfratechpvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Godhar Infratech Pvt ltd'), false)
})

test('Godhar Infratech Pvt ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Godhar Infratech Pvt ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Godhar Infratech Pvt ltd', 'godharinfratechpvtltd', 'Godhar Infratech Pvt ltd']],
  )
})

test('Godhar Infratech Pvt ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'godharinfratechpvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Godhar Infratech Pvt ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'godharinfratechpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://godharinfratech.com/')
  assert.match(scraper.dryRunFile, /godharinfratechpvtltd[\\/]jobs\.json$/i)
})
