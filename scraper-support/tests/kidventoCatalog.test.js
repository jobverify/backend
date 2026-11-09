import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kidvento is registered as a native Keka scraper with incomplete company scope and no aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kidvento')

  assert.ok(provider, 'Expected Kidvento provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Kidvento Education and Research Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.kidvento.com/careers')
  assert.equal(provider.atsPlatform, 'keka')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-board-and-embed-opening-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'actual-google-sites-controller-frame-binding+native-keka-full-records+all-visible-details+explicit-country-evidence+partial-source-scope',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kidvento.com')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.modulePath, /kidvento[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Kidvento Education and Research Private Limited'),
    false,
  )
})

test('Kidvento matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kidvento Education and Research Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kidvento Education and Research Private Limited', 'kidvento', 'Kidvento Education and Research Private Limited']],
  )
})

test('Kidvento is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kidvento')

  assert.ok(scraper, 'Expected buildScrapers() to return the Kidvento scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kidvento')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.kidvento.com/careers')
  assert.match(scraper.dryRunFile, /kidvento[\\/]jobs\.json$/i)
})
