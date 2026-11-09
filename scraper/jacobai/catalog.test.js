import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Jacob AI is registered as a verified parked-domain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jacobai')

  assert.ok(provider, 'Expected Jacob AI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Jacob AI')
  assert.equal(provider.companyCareerPage, 'https://jacob.ai/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-first-party-parked-domain-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-parked-domain-for-sale-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jacob.ai')
  assert.match(provider.modulePath, /jacobai[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Jacob AI'), false)
})

test('Jacob AI matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Jacob AI\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jacob AI', 'jacobai', 'Jacob AI']],
  )
})

test('Jacob AI is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jacobai')

  assert.ok(scraper, 'Expected buildScrapers() to return the Jacob AI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jacobai')
  assert.equal(scraper.provider.companyCareerPage, 'https://jacob.ai/')
  assert.match(scraper.dryRunFile, /jacobai[\\/]jobs\.json$/i)
})
