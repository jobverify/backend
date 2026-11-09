import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SHRIRAM FINANCE LIMITED is registered as a verified first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'shriramfinancelimited')

  assert.ok(provider, 'Expected SHRIRAM FINANCE LIMITED provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SHRIRAM FINANCE LIMITED')
  assert.equal(provider.companyCareerPage, 'https://www.shriramfinance.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-session-api-page-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+session-backed-current-opening-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'shriramfinance.in')
  assert.match(provider.modulePath, /shriramfinancelimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SHRIRAM FINANCE LIMITED'), false)
})

test('SHRIRAM FINANCE LIMITED matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SHRIRAM FINANCE LIMITED,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SHRIRAM FINANCE LIMITED', 'shriramfinancelimited', 'SHRIRAM FINANCE LIMITED']],
  )
})

test('SHRIRAM FINANCE LIMITED is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'shriramfinancelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the SHRIRAM FINANCE LIMITED scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'shriramfinancelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.shriramfinance.in/careers')
  assert.match(scraper.dryRunFile, /shriramfinancelimited[\\/]jobs\.json$/i)
})
