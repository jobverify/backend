import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Giant Eagle is registered as a Phenom script provider with its official careers board metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gianteagle')

  assert.ok(provider, 'Expected Giant Eagle provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Giant Eagle')
  assert.equal(provider.companyCareerPage, 'https://jobs.gianteagle.com/in/hi/search-results')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'phenom-search+detail-enrichment')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.gianteagle.com')
  assert.match(provider.modulePath, /gianteagle[\\/]script\.js$/i)
})

test('Giant Eagle resolves through coverage matching and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'giant eagle,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['giant eagle', 'gianteagle', 'Giant Eagle']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'gianteagle')

  assert.ok(scraper, 'Expected buildScrapers() to return the Giant Eagle scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gianteagle')
  assert.equal(scraper.provider.companyCareerPage, 'https://jobs.gianteagle.com/in/hi/search-results')
  assert.match(scraper.dryRunFile, /gianteagle[\\/]jobs\.json$/i)
})
