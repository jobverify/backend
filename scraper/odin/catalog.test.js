import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Odin is registered against the public Ashby board contract', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'odin')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Odin')
  assert.equal(provider.companyCareerPage, 'https://www.joinodin.com/')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'public-get-original-native-opening-closing-before-country-and-caps')
  assert.equal(provider.extractionStrategy, 'current-company-binding+original-all-country-native-own-records')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'joinodin.com')
  assert.match(provider.modulePath, /odin[\\/]script\.js$/i)
})

test('ODIN matches company coverage directly and remains runnable through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ODIN\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ODIN', 'odin', 'Odin']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'odin')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'odin')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.joinodin.com/')
  assert.match(scraper.dryRunFile, /odin[\\/]jobs\.json$/i)
})
