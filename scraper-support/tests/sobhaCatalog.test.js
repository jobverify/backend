import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Sobha is registered against the verified official careers page and broken PeopleStrong handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sobha')

  assert.ok(provider, 'Expected Sobha provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sobha Limited')
  assert.equal(provider.companyCareerPage, 'https://www.sobha.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+verified-broken-peoplestrong-joblist')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sobha.com')
  assert.match(provider.modulePath, /sobha[\\/]script\.js$/i)
})

test('Sobha aliases resolve the close CSV row variants to the sobha source', () => {
  assert.equal(companyAliases['Sobha Limited'], 'sobha')
  assert.equal(companyAliases['Sobha Constructions'], 'sobha')
  assert.equal(companyAliases['Sobha Developer'], 'sobha')

  const report = generateCompanyCoverageReport({
    csvText: 'Sobha Limited,\nSobha Constructions,\nSobha Developer,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Sobha Limited', 'sobha'],
    ['Sobha Constructions', 'sobha'],
    ['Sobha Developer', 'sobha'],
  ])
})

test('Sobha is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sobha')

  assert.ok(scraper, 'Expected buildScrapers() to return the Sobha scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sobha')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sobha.com/careers/')
  assert.match(scraper.dryRunFile, /sobha[\\/]jobs\.json$/i)
})
