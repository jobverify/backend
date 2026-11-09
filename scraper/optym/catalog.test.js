import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Optym is registered against its official careers page and matches the extracted CSV row', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'optym')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Optym')
  assert.equal(provider.companyCareerPage, 'https://www.optym.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page-plus-no-public-listings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'optym.com')
  assert.match(provider.modulePath, /optym[\\/]script\.js$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Optym,',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.companyName, 'Optym')
  assert.equal(report.matched[0]?.source, 'optym')
  assert.equal(report.matched[0]?.provider?.companyName, 'Optym')
})

test('Optym is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'optym')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /optym[\\/]jobs\.json$/i)
})
