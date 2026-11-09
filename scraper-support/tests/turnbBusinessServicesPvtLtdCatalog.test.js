import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('TurnB Business Services Pvt. Ltd is registered against the official first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'turnbbusinessservicespvtltd')

  assert.ok(provider, 'Expected TurnB Business Services Pvt. Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TurnB Business Services Pvt. Ltd')
  assert.equal(provider.companyCareerPage, 'https://turnb.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-tabbed-public-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'official-tabbed-careers-page+india-pdf-role-cards+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'turnb.com')
  assert.match(provider.modulePath, /turnbbusinessservicespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TurnB Business Services Pvt. Ltd'), false)
})

test('TurnB Business Services Pvt. Ltd matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'TurnB Business Services Pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TurnB Business Services Pvt. Ltd', 'turnbbusinessservicespvtltd', 'TurnB Business Services Pvt. Ltd']],
  )
})

test('TurnB Business Services Pvt. Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'turnbbusinessservicespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the TurnB Business Services Pvt. Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'turnbbusinessservicespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://turnb.com/career')
  assert.match(scraper.dryRunFile, /turnbbusinessservicespvtltd[\\/]jobs\.json$/i)
})
