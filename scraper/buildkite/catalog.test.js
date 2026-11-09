import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'buildkite'
const COMPANY = 'Buildkite'
const CAREERS_URL = 'https://buildkite.com/about/careers/'

test('Buildkite is registered as a bounded current first-party careers plus Greenhouse provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Buildkite provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-feed-and-office-index;all-own-details-opening-closing;final-native-feed-after-details')
  assert.equal(
    provider.extractionStrategy,
    'active-public-inventory-program+original-native-models+explicit-own-JD-workplace-country-proof',
  )
  assert.equal(provider.parser, 'bound-current-public-greenhouse-board')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.sourcePublicInventoryProgramReviewedOn, '2026-11-03')
  assert.equal(provider.configuredBoardProofRequiresLiveEvidence, true)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'buildkite.com')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.match(provider.verifiedSurfaceSummary, /unverified/i)
  assert.match(provider.modulePath, /buildkite[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Buildkite resolves directly from provider metadata and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Buildkite,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Buildkite', SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Buildkite scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /buildkite[\\/]jobs\.json$/i)
})
