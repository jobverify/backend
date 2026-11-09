import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('TMEIC Industrial Systems India Private Limited is registered against the official global careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tmeicindustrialsystemsindia')

  assert.ok(provider, 'Expected TMEIC Industrial Systems India Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TMEIC Industrial Systems India Private Limited')
  assert.equal(provider.companyCareerPage, 'https://tmeic.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-global-careers-page-with-region-section')
  assert.equal(
    provider.extractionStrategy,
    'verified-global-careers-page+india-no-public-opportunities-shell',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tmeic.com')
  assert.match(provider.modulePath, /tmeicindustrialsystemsindia[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'TMEIC Industrial Systems India Private Limited'),
    false,
  )
})

test('TMEIC Industrial Systems India Private Limited matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,TMEIC Industrial Systems India Private Limited\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['TMEIC Industrial Systems India Private Limited', 'tmeicindustrialsystemsindia'],
  ])
})

test('TMEIC Industrial Systems India Private Limited is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tmeicindustrialsystemsindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the TMEIC Industrial Systems India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tmeicindustrialsystemsindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://tmeic.com/careers/')
  assert.match(scraper.dryRunFile, /tmeicindustrialsystemsindia[\\/]jobs\.json$/i)
})
