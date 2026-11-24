import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Wonksknow is registered against the current own India careers and selected native role surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wonksknow')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Wonksknow')
  assert.equal(provider.companyCareerPage, 'https://www.wonksknow.com/')
  assert.equal(provider.atsPlatform, 'Vinterview')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paired-own-country-declaration-native-overview-selected-role-pages')
  assert.equal(
    provider.extractionStrategy,
    'current-own-India-Careers-account-membership+selected-public-role-partials+literal-unvisited-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'wonksknow.com')
  assert.match(provider.modulePath, /wonksknow[\\/]script\.js$/i)
  assert.equal(provider.catalogOverride, true)
  assert.equal(provider.backfillMode, 'live-parser')
  assert.equal(provider.authoritativeCurrentPublication, true)
  assert.equal(provider.scraperTimeoutMs, 190000)
  assert.equal(provider.runtimeSourceScopeVerification, true)
  assert.equal(provider.verifiedInventoryStatus, 'unverified')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  for (const key of ['verifiedOn', 'verifiedAt', 'verifiedPublicJobCount', 'verifiedGlobalJobCount', 'verifiedIndiaJobCount', 'companyGlobalTotal', 'companyIndiaTotal', 'currentProgrammeZeroProfile', 'legalEmployerName']) assert.equal(provider[key], null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})

test('Wonksknow matches company coverage directly and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Wonksknow\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Wonksknow', 'wonksknow', 'Wonksknow']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'wonksknow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wonksknow')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.wonksknow.com/')
  assert.match(scraper.dryRunFile, /wonksknow[\\/]jobs\.json$/i)
})
