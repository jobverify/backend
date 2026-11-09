import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('InSolare Energy is registered as a verified official careers form scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'insolareenergy')

  assert.ok(provider, 'Expected InSolare Energy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'InSolare Energy')
  assert.equal(provider.companyCareerPage, 'https://insolare.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-handoff-plus-first-party-careers-form-role-options',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-form-role-options',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'insolare.com')
  assert.match(provider.modulePath, /insolareenergy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'InSolare Energy'), false)
})

test('InSolare Energy matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'InSolare Energy,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['InSolare Energy', 'insolareenergy', 'InSolare Energy']],
  )
})

test('InSolare Energy is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'insolareenergy')

  assert.ok(scraper, 'Expected buildScrapers() to return the InSolare Energy scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'insolareenergy')
  assert.equal(scraper.provider.companyCareerPage, 'https://insolare.com/careers/')
  assert.match(scraper.dryRunFile, /insolareenergy[\\/]jobs\.json$/i)
})
