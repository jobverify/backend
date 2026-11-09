import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Neostats is registered against the verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neostats')

  assert.ok(provider, 'Expected Neostats provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NeoStats')
  assert.equal(provider.companyCareerPage, 'https://neostats.ai/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-inline-global-role-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-public-careers-page+inline-role-cards+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'neostats.ai')
  assert.match(provider.modulePath, /neostats[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NeoStats'), false)
})

test('Neostats matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NeoStats,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NeoStats', 'neostats', 'NeoStats']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'neostats')

  assert.ok(scraper, 'Expected buildScrapers() to return the Neostats scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'neostats')
  assert.equal(scraper.provider.companyCareerPage, 'https://neostats.ai/careers')
  assert.match(scraper.dryRunFile, /neostats[\\/]jobs\.json$/i)
})
