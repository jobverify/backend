import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Persevex is registered with the verified first-party careers page and direct CSV company match', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'persevex')

  assert.ok(provider, 'Expected Persevex provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Persevex')
  assert.equal(provider.companyCareerPage, 'https://www.persevex.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page+published-static-client')
  assert.equal(provider.extractionStrategy, 'verified-first-party-handoff+published-client-role-literal+visible-card-binding+explicit-India-locations')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'persevex.com')
  assert.equal(provider.verifiedPublicJobCount, 6)
  assert.equal(provider.verifiedIndiaJobCount, 5)
  assert.equal(provider.unverifiedGeographyCount, 1)
  assert.match(provider.verifiedSurfaceSummary, /coverage-gap/i)
  assert.match(provider.modulePath, /persevex[\\/]script\.js$/i)
})

test('PERSEVEX matches company coverage through direct normalization', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PERSEVEX,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PERSEVEX', 'persevex', 'Persevex']],
  )
})

test('Persevex is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'persevex')

  assert.ok(scraper, 'Expected buildScrapers() to return the Persevex scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'persevex')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.persevex.com/careers')
  assert.match(scraper.dryRunFile, /persevex[\\/]jobs\.json$/i)
})
