import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('GITA IT is registered through the custom provider catalog without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gitait')

  assert.ok(provider, 'Expected GITA IT provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GITA IT')
  assert.equal(provider.companyCareerPage, 'https://gitait.com/careers.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+verified-careers-page+verified-detail-pages+same-page-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'gitait.com')
  assert.match(provider.modulePath, /gitait[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GITA IT'), false)
})

test('GITA IT matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'GITA IT\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GITA IT', 'gitait', 'GITA IT']],
  )
})

test('GITA IT is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gitait')

  assert.ok(scraper, 'Expected buildScrapers() to return the GITA IT scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gitait')
  assert.equal(scraper.provider.companyCareerPage, 'https://gitait.com/careers.html')
  assert.match(scraper.dryRunFile, /gitait[\\/]jobs\.json$/i)
})
