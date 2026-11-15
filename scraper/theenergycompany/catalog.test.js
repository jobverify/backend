import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'theenergycompany'
const COMPANY = 'The ENERGY COMPANY'
const CAREERS_URL = 'https://www.energycompany.in/we-are-hiring'

test('The ENERGY COMPANY is registered against its verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected The ENERGY COMPANY provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'first-party-server-rendered-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-native-html-role-accordions-plus-independent-publisher-application-style-closing')
  assert.equal(
    provider.extractionStrategy,
    'current-own-configured-publisher+visible-scoped-native-country+complete-role-and-common-hiring-criteria+exact-own-role-query-application+fresh-closing',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.backfillMode, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'energycompany.in')
  assert.match(provider.modulePath, /theenergycompany[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('The ENERGY COMPANY matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('The ENERGY COMPANY is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the The ENERGY COMPANY scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /theenergycompany[\\/]jobs\.json$/i)
})
