import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kreeti Technologies is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kreetitechnologies')

  assert.ok(provider, 'Expected Kreeti Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Kreeti Technologies')
  assert.equal(provider.companyCareerPage, 'https://careers.kreeti.com/candidates')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-home-plus-active-openings-section',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-home+explicit-active-openings-state+general-interest-excluded',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kreeti.com')
  assert.match(provider.modulePath, /kreetitechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kreeti Technologies'), false)
})

test('Kreeti Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kreeti Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kreeti Technologies', 'kreetitechnologies', 'Kreeti Technologies']],
  )
})

test('Kreeti Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kreetitechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Kreeti Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kreetitechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.kreeti.com/candidates')
  assert.match(scraper.dryRunFile, /kreetitechnologies[\\/]jobs\.json$/i)
})
