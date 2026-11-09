import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('NYEI is registered directly against the verified first-party careers page without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nyei')

  assert.ok(provider, 'Expected NYEI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NYEI')
  assert.equal(
    provider.companyCareerPage,
    'https://www.ny-engineers.com/about/engineering-career-opportunities',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-inline-accordion-role-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-public-careers-page+inline-accordion-role-cards+india-location-filter+same-page-apply-anchor',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ny-engineers.com')
  assert.match(provider.modulePath, /nyei[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NYEI'), false)
})

test('NYEI matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NYEI,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NYEI', 'nyei', 'NYEI']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'nyei')

  assert.ok(scraper, 'Expected buildScrapers() to return the NYEI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nyei')
  assert.equal(
    scraper.provider.companyCareerPage,
    'https://www.ny-engineers.com/about/engineering-career-opportunities',
  )
  assert.match(scraper.dryRunFile, /nyei[\\/]jobs\.json$/i)
})
