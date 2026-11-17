import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'waydotcomindia'
const COMPANY = 'Way Dot Com India Private Limited'
const CAREERS_URL = 'https://www.way.com/careers'

test('Way Dot Com India Private Limited is registered as a verified first-party public careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Way Dot Com India Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'official-current-native-careers-access-denied')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'one-exact-configured-current-careers-request-stop-on-denial')
  assert.equal(
    provider.extractionStrategy,
    'original-http-status-and-employer-url-identity+no-legacy-jobs-json-or-body-only-fallback+native-inventory-unknown',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'way.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare 'Just a moment/i)
  assert.match(provider.modulePath, /waydotcomindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Way Dot Com India Private Limited resolves from provider metadata and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Way Dot Com India Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Way Dot Com India Private Limited', SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Way Dot Com India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /waydotcomindia[\\/]jobs\.json$/i)
})
