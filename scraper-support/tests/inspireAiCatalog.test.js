import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Inspire AI is registered with current native HTML/API observations and held company scope', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'inspireai')

  assert.ok(provider, 'Expected Inspire AI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Inspire AI')
  assert.equal(provider.companyCareerPage, 'https://inspireai.com/careers/')
  assert.equal(provider.atsPlatform, 'wordpress-current-careers-html-api-accordion-country-unqualified')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'declared-current-careers-page8033-whole-html-api-models-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'dynamic-full-native-accordion-models+literal-role-country-only+future-intake-separated+application-and-company-scope-held',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'inspireai.com')
  assert.match(provider.modulePath, /inspireai[\\/]script\.js$/i)
})

test('Inspire AI matches backlog coverage directly and is runnable through buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Inspire AI,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Inspire AI', 'inspireai', 'Inspire AI']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'inspireai')

  assert.ok(scraper, 'Expected buildScrapers() to return the Inspire AI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'inspireai')
  assert.equal(scraper.provider.companyCareerPage, 'https://inspireai.com/careers/')
  assert.match(scraper.dryRunFile, /inspireai[\\/]jobs\.json$/i)
})
