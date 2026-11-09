import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Manatec Electronics is registered as a verified application-only scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'manatecelectronics')

  assert.ok(provider, 'Expected Manatec Electronics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Manatec Electronics Private Limited')
  assert.equal(provider.companyCareerPage, 'https://manatec.in/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'bounded-homepage-plus-careers-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+application-only-careers+typed-unavailable-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'manatec.in')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.verifiedSurfaceSummary, /Verified on Sunday, September 13, 2026/i)
  assert.match(provider.modulePath, /manatecelectronics[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Manatec Electronics Private Limited'),
    false,
  )
})

test('Manatec Electronics matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Manatec Electronics Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Manatec Electronics Private Limited', 'manatecelectronics', 'Manatec Electronics Private Limited']],
  )
})

test('Manatec Electronics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'manatecelectronics')

  assert.ok(scraper, 'Expected buildScrapers() to return the Manatec Electronics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'manatecelectronics')
  assert.equal(scraper.provider.companyCareerPage, 'https://manatec.in/career/')
  assert.match(scraper.dryRunFile, /manatecelectronics[\\/]jobs\.json$/i)
})
