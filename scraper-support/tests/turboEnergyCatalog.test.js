import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Turbo Energy is registered against the official first-party empty careers shell without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'turboenergy')

  assert.ok(provider, 'Expected Turbo Energy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Turbo Energy')
  assert.equal(provider.companyCareerPage, 'https://www.turboenergy.co.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-handoff-plus-empty-careers-shell',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-empty-careers-shell',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'turboenergy.co.in')
  assert.match(provider.modulePath, /turboenergy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Turbo Energy'), false)
})

test('Turbo Energy matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Turbo Energy,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Turbo Energy', 'turboenergy', 'Turbo Energy']],
  )
})

test('Turbo Energy is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'turboenergy')

  assert.ok(scraper, 'Expected buildScrapers() to return the Turbo Energy scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'turboenergy')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.turboenergy.co.in/careers/')
  assert.match(scraper.dryRunFile, /turboenergy[\\/]jobs\.json$/i)
})
