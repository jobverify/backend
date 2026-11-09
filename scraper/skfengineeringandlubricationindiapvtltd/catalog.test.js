import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SKF Engineering and Lubrication India Pvt Ltd is registered against the verified first-party SKF jobs board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'skfengineeringandlubricationindiapvtltd')

  assert.ok(provider, 'Expected SKF Engineering and Lubrication India Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SKF Engineering and Lubrication India Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://career.skf.com/search/?q=&sortColumn=referencedate&sortDirection=desc')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-jobs-home-plus-paginated-search-results')
  assert.equal(
    provider.extractionStrategy,
    'verified-jobs-home+search-results+india-filtered-detail-pages+apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'career.skf.com')
  assert.match(provider.modulePath, /skfengineeringandlubricationindiapvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SKF Engineering and Lubrication India Pvt Ltd'), false)
})

test('SKF Engineering and Lubrication India Pvt Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SKF Engineering and Lubrication India Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SKF Engineering and Lubrication India Pvt Ltd', 'skfengineeringandlubricationindiapvtltd', 'SKF Engineering and Lubrication India Pvt Ltd']],
  )
})

test('SKF Engineering and Lubrication India Pvt Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'skfengineeringandlubricationindiapvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the SKF Engineering and Lubrication India Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'skfengineeringandlubricationindiapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://career.skf.com/search/?q=&sortColumn=referencedate&sortDirection=desc')
  assert.match(scraper.dryRunFile, /skfengineeringandlubricationindiapvtltd[\\/]jobs\.json$/i)
})
