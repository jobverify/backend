import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Ohmium Operations (P) Ltd is registered against the verified official Ohmium careers handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ohmiumoperationspltd')

  assert.ok(provider, 'Expected Ohmium provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ohmium Operations (P) Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.ohmium.com/')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-workday-handoff-plus-workday-runner')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-ohmium-workday-board+india-filtered-workday-runner',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ohmium.com')
  assert.match(provider.modulePath, /ohmiumoperationspltd\.workday[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ohmium Operations (P) Ltd'), false)
})

test('Ohmium Operations (P) Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ohmium Operations (P) Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ohmium Operations (P) Ltd', 'ohmiumoperationspltd', 'Ohmium Operations (P) Ltd']],
  )
})

test('Ohmium Operations (P) Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ohmiumoperationspltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ohmium scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ohmiumoperationspltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ohmium.com/')
  assert.match(scraper.dryRunFile, /ohmiumoperationspltd\.workday[\\/]jobs\.json$/i)
})
