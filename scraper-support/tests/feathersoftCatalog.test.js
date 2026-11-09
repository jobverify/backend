import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Feathersoft is registered against the verified official homepage and empty careers shell without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'feathersoft')

  assert.ok(provider, 'Expected Feathersoft provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Feathersoft')
  assert.equal(provider.companyCareerPage, 'https://www.feathersoft.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-handoff-plus-empty-careers-shell')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-empty-careers-shell',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'feathersoft.com')
  assert.match(provider.modulePath, /feathersoft[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Feathersoft'), false)
})

test('Feathersoft matches the backlog directly from provider metadata without adding a company alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Feathersoft,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Feathersoft', 'feathersoft', 'Feathersoft']],
  )
})

test('Feathersoft is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'feathersoft')

  assert.ok(scraper, 'Expected buildScrapers() to return the Feathersoft scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'feathersoft')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.feathersoft.com/careers/')
  assert.match(scraper.dryRunFile, /feathersoft[\\/]jobs\.json$/i)
})
