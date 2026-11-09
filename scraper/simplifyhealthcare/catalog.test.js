import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Simplify Healthcare is registered against the official current openings surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'simplifyhealthcare')

  assert.ok(provider, 'Expected Simplify Healthcare provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Simplify Healthcare')
  assert.equal(provider.companyCareerPage, 'https://simplifyhealthcare.com/careers/current-openings/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-listing-page-plus-india-category-bfs')
  assert.equal(
    provider.extractionStrategy,
    'official-current-openings-pages+same-domain-india-detail-pages+related-post-discovery',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'simplifyhealthcare.com')
  assert.match(provider.modulePath, /simplifyhealthcare[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Simplify Healthcare'), false)
})

test('Simplify Healthcare matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Simplify Healthcare,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Simplify Healthcare', 'simplifyhealthcare'],
  ])
})

test('Simplify Healthcare is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'simplifyhealthcare')

  assert.ok(scraper, 'Expected buildScrapers() to return the Simplify Healthcare scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'simplifyhealthcare')
  assert.equal(scraper.provider.companyCareerPage, 'https://simplifyhealthcare.com/careers/current-openings/')
  assert.match(scraper.dryRunFile, /simplifyhealthcare[\\/]jobs\.json$/i)
})
