import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('NexTurn is registered against its verified first-party careers page and same-domain detail pages', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nexturn')

  assert.ok(provider, 'Expected NexTurn provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NexTurn')
  assert.equal(provider.companyCareerPage, 'https://nexturn.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page+detail-fetch')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-job-cards+same-domain-detail-pages+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nexturn.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 57)
  assert.equal(provider.verifiedIndiaJobCount, 47)
  assert.equal(provider.verifiedSampleJobTitle, 'Salesforce Project Manager')
  assert.equal(provider.verifiedSampleJobUrl, 'https://nexturn.com/job/salesforce-project-manager/')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /13\.202\.106\.64/i)
  assert.match(provider.modulePath, /nexturn[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NexTurn'), false)
})

test('NexTurn matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NexTurn,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NexTurn', 'nexturn', 'NexTurn']],
  )
})

test('NexTurn is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nexturn')

  assert.ok(scraper, 'Expected buildScrapers() to return the NexTurn scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nexturn')
  assert.equal(scraper.provider.companyCareerPage, 'https://nexturn.com/careers/')
  assert.match(scraper.dryRunFile, /nexturn[\\/]jobs\.json$/i)
})
