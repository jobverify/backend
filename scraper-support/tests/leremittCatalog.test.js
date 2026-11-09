import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('LeRemitt is registered as a verified product-brand zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'leremitt')

  assert.ok(provider, 'Expected LeRemitt provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'LeRemitt')
  assert.equal(provider.companyCareerPage, 'https://www.axodian.com/leremitt')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'parent-homepage-plus-product-page-plus-missing-parent-careers-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-parent-homepage+verified-product-page+verified-missing-parent-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'axodian.com')
  assert.match(provider.modulePath, /leremitt[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'LeRemitt'), false)
})

test('LeRemitt matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'LeRemitt,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LeRemitt', 'leremitt', 'LeRemitt']],
  )
})

test('LeRemitt is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'leremitt')

  assert.ok(scraper, 'Expected buildScrapers() to return the LeRemitt scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'leremitt')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.axodian.com/leremitt')
  assert.match(scraper.dryRunFile, /leremitt[\\/]jobs\.json$/i)
})
