import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Avaya India as a SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avayaindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Avaya India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.avaya.com/search/?createNewAlert=false&optionsFacetsDD_department=&optionsFacetsDD_location=&optionsFacetsDD_title=&q=',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'startrow-query')
  assert.equal(
    provider.extractionStrategy,
    'successfactors-search-results-table+detail-pages+talentcommunity-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.avaya.com')
  assert.match(provider.modulePath, /avayaindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Avaya India to avayaindia', () => {
  const scraper = buildScrapers().find((item) => item.name === 'avayaindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /avayaindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'avayaindia')

  const report = generateCompanyCoverageReport({
    csvText: 'Avaya India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avaya India', 'avayaindia', 'Avaya India']],
  )
})
