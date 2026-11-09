import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog describes the current Asteria native Keka reader', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'asteriaaerospace')

  assert.ok(provider, 'Expected Asteria Aerospace provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Asteria Aerospace')
  assert.equal(provider.companyCareerPage, 'https://asteria.co.in/careers')
  assert.equal(provider.atsPlatform, 'keka')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'declared-native-active-array-with-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-Keka-iframe+account-identity+full-native-active-records+explicit-country+closing-model-reconciliation',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'asteria.co.in')
  assert.match(provider.modulePath, /asteriaaerospace[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Asteria Aerospace to the asteriaaerospace source', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Asteria Aerospace,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Asteria Aerospace', 'asteriaaerospace', 'Asteria Aerospace']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'asteriaaerospace')

  assert.ok(scraper, 'Expected buildScrapers() to return the Asteria Aerospace scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'asteriaaerospace')
  assert.equal(scraper.provider.companyCareerPage, 'https://asteria.co.in/careers')
  assert.match(scraper.dryRunFile, /asteriaaerospace[\\/]jobs\.json$/i)
})
