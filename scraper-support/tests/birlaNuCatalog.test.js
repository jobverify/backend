import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('BirlaNu is registered against the verified first-party people page without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'birlanu')

  assert.ok(provider, 'Expected BirlaNu provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'BirlaNu')
  assert.equal(provider.companyCareerPage, 'https://birlanu.com/people')
  assert.equal(provider.atsPlatform, 'darwinbox-public-native')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.paginationStrategy, 'full-native-board+all-public-details+final-listing-after-closing-details')
  assert.equal(
    provider.extractionStrategy,
    'current-active-corporate-handoff+strict-native-identity-country-and-public-criteria+blocked-host-cache',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'birlanu.com')
  assert.match(provider.modulePath, /birlanu[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'BirlaNu'), false)
})

test('BirlaNu matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'BirlaNu,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['BirlaNu', 'birlanu'],
  ])
})

test('BirlaNu is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'birlanu')

  assert.ok(scraper, 'Expected buildScrapers() to return the BirlaNu scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'birlanu')
  assert.equal(scraper.provider.companyCareerPage, 'https://birlanu.com/people')
  assert.match(scraper.dryRunFile, /birlanu[\\/]jobs\.json$/i)
})
