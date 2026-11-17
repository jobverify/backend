import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('TEB Solutions is registered against its verified first-party no-public-jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tebsolutions')

  assert.ok(provider, 'Expected TEB Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TEB Solutions')
  assert.equal(provider.companyCareerPage, 'https://tebsolutions.in/')
  assert.equal(provider.atsPlatform, 'current-own-corporate-publisher-recruitment-inventory-unknown')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'own-current-home-and-actually-declared-about-contact-models-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'whole-current-corporate-structured-and-authored-models+opaque-contacts-raw-and-unqualified+no-corporate-country-or-date-as-role-facts+company-inventory-unqualified',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tebsolutions.in')
  assert.match(provider.modulePath, /tebsolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TEB Solutions'), false)
})

test('TEB Solutions matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'TEB Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TEB Solutions', 'tebsolutions', 'TEB Solutions']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'tebsolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the TEB Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tebsolutions')
  assert.equal(scraper.provider.companyCareerPage, 'https://tebsolutions.in/')
  assert.match(scraper.dryRunFile, /tebsolutions[\\/]jobs\.json$/i)
})
