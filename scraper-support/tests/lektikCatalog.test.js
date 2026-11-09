import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Lektik is registered as a verified first-party GraphQL careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lektik')

  assert.ok(provider, 'Expected Lektik provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lektik')
  assert.equal(provider.companyCareerPage, 'https://www.lektik.com/careers')
  assert.equal(provider.atsPlatform, 'official-first-party-graphql-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-shell-plus-first-party-graphql-list')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-shell+graphql-listings+graphql-detail-queries',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lektik.com')
  assert.match(provider.modulePath, /lektik[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lektik'), false)
})

test('Lektik matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Lektik,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lektik', 'lektik', 'Lektik']],
  )
})

test('Lektik is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lektik')

  assert.ok(scraper, 'Expected buildScrapers() to return the Lektik scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lektik')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.lektik.com/careers')
  assert.match(scraper.dryRunFile, /lektik[\\/]jobs\.json$/i)
})
