import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Wheels India Limited is registered against the verified first-party openings page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wheelsindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Wheels India Limited')
  assert.equal(provider.companyCareerPage, 'https://wheelsindia.com/career-opportunities/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-hub-and-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-hub+verified-first-party-openings-page+inline-role-cards+raw-mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'wheelsindia.com')
  assert.match(provider.modulePath, /wheelsindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Wheels India Limited'), false)
})

test('Wheels India Limited resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Wheels India Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Wheels India Limited', 'wheelsindia', 'Wheels India Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'wheelsindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wheelsindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://wheelsindia.com/career-opportunities/')
  assert.match(scraper.dryRunFile, /wheelsindia[\\/]jobs\.json$/i)
})
