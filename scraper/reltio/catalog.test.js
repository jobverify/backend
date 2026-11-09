import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Reltio is registered with the verified first-party careers page and exact CSV alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'reltio')

  assert.ok(provider, 'Expected Reltio provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Reltio')
  assert.equal(provider.companyCareerPage, 'https://www.reltio.com/careers/open-positions/')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-embedded-greenhouse-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-open-positions-page+embedded-greenhouse-jobs-api+greenhouse-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'reltio.com')
  assert.match(provider.modulePath, /reltio[\\/]script\.js$/i)
  assert.equal(companyAliases.RELTIO, 'reltio')
})

test('RELTIO matches company coverage through the explicit CSV alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'RELTIO,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RELTIO', 'reltio', 'Reltio']],
  )
})

test('Reltio is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'reltio')

  assert.ok(scraper, 'Expected buildScrapers() to return the Reltio scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'reltio')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.reltio.com/careers/open-positions/')
  assert.match(scraper.dryRunFile, /reltio[\\/]jobs\.json$/i)
})
