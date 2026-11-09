import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kirloskar Brothers Ltd is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kirloskarbrothersltd')

  assert.ok(provider, 'Expected Kirloskar Brothers Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Kirloskar Brothers Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.kirloskarpumps.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-resume-only-careers-surface-or-503-outage-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kirloskarpumps.com')
  assert.match(provider.modulePath, /kirloskarbrothersltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kirloskar Brothers Ltd'), false)
})

test('Kirloskar Brothers Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kirloskar Brothers Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kirloskar Brothers Ltd', 'kirloskarbrothersltd', 'Kirloskar Brothers Ltd']],
  )
})

test('Kirloskar Brothers Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kirloskarbrothersltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Kirloskar Brothers Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kirloskarbrothersltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.kirloskarpumps.com/careers/')
  assert.match(scraper.dryRunFile, /kirloskarbrothersltd[\\/]jobs\.json$/i)
})
