import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Nobrokers is registered as a verified first-party Firebase jobs scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nobrokers')

  assert.ok(provider, 'Expected Nobrokers provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NoBroker')
  assert.equal(provider.companyCareerPage, 'https://www.nobroker.in/careers')
  assert.equal(provider.atsPlatform, 'official-current-firebase-feed-observations-expired-details-scope-held')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'active-own-careers-programme-bound-feed-and-authored-handoff-opening-closing-stop-denied-host',
  )
  assert.equal(
    provider.extractionStrategy,
    'current-executable-bound-native-feed-metadata+expired-detail-redirects-and-observed-denial-retained+full-criteria-active-application-and-company-scope-unqualified',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nobroker.in')
  assert.match(provider.modulePath, /nobrokers[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nobrokers'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NoBroker'), false)
})

test('company coverage resolves the exact Nobrokers CSV row without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Nobrokers,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nobrokers', 'nobrokers', 'NoBroker']],
  )
})

test('buildScrapers exposes a runnable Nobrokers scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nobrokers')

  assert.ok(scraper, 'Expected buildScrapers() to return the Nobrokers scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nobrokers')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.nobroker.in/careers')
  assert.match(scraper.dryRunFile, /nobrokers[\\/]jobs\.json$/i)
})
