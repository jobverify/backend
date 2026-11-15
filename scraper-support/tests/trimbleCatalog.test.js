import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the current Trimble corporate Paradox reader with incomplete scope', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'trimble')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'paradox-first-party-careers')
  assert.equal(provider.companyName, 'Trimble')
  assert.equal(provider.companyCareerPage, 'https://www.trimble.com/en/careers')
  assert.equal(provider.companyDomain, 'trimble.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'bounded-native-Paradox-pages-coverage-incomplete')
  assert.equal(provider.extractionStrategy, 'current-corporate-handoff+visible-own-role+typed-country+native-application')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /trimble[\\/]script\.js$/)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})

test('buildScrapers and company coverage preserve Trimble Inc source identity after the native migration', () => {
  const scraper = buildScrapers().find((item) => item.name === 'trimble')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /trimble[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'trimble')

  const report = generateCompanyCoverageReport({
    csvText: 'Trimble Inc,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Trimble Inc', 'trimble', 'Trimble']],
  )
})
