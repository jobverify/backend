import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('KodNest is registered as a verified first-party public careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kodnest')

  assert.ok(provider, 'Expected KodNest provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KodNest')
  assert.equal(provider.companyCareerPage, 'https://kodnest.com/career')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-public-careers-feed-limit-offset')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-shell+public-careers-client+published-jobs-feed+closing-date-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kodnest.com')
  assert.match(provider.modulePath, /kodnest[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kodnest'), false)
})

test('KodNest matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kodnest,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kodnest', 'kodnest', 'KodNest']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'kodnest')

  assert.ok(scraper, 'Expected buildScrapers() to return the KodNest scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kodnest')
  assert.equal(scraper.provider.companyCareerPage, 'https://kodnest.com/career')
  assert.match(scraper.dryRunFile, /kodnest[\\/]jobs\.json$/i)
})
