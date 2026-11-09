import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Britannia as an official TurboHire careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'britannia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'turbohire')
  assert.equal(provider.companyName, 'Britannia Industries')
  assert.equal(provider.companyCareerPage, 'https://www.britannia.co.in/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-handoff-plus-public-turbohire-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+turbohire-board+noauth-token+filteredjobs-api'+"+full-native-public-role+CareerPage-publication+closing-reconciliation",
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'britannia.co.in')
  assert.match(provider.modulePath, /britannia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve both Britannia aliases to britannia', () => {
  const scraper = buildScrapers().find((item) => item.name === 'britannia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'britannia')
  assert.match(scraper.dryRunFile, /britannia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Britannia,\nBritannia Industries,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [
      ['Britannia', 'britannia', 'britannia'],
      ['Britannia Industries', 'britannia', 'britannia'],
    ],
  )
})
