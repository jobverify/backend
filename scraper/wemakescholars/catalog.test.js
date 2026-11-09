import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('WeMakeScholars is registered against the official public hiring page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wemakescholars')

  assert.ok(provider, 'Expected WeMakeScholars provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'WeMakeScholars')
  assert.equal(provider.companyCareerPage, 'https://www.wemakescholars.com/hiring')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-hiring-page')
  assert.equal(provider.extractionStrategy, 'official-hiring-page+inline-role-cards+same-page-apply-deeplinks')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'wemakescholars.com')
  assert.match(provider.modulePath, /wemakescholars[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'WeMakeScholars'), false)
})

test('WeMakeScholars matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'WeMakeScholars,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['WeMakeScholars', 'wemakescholars'],
  ])
})

test('WeMakeScholars is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'wemakescholars')

  assert.ok(scraper, 'Expected buildScrapers() to return the WeMakeScholars scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wemakescholars')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.wemakescholars.com/hiring')
  assert.match(scraper.dryRunFile, /wemakescholars[\\/]jobs\.json$/i)
})
