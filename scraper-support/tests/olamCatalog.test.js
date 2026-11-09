import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Olam as a SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'olam')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Olam')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.olamgroup.com/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield3=&q=',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'startrow-query')
  assert.equal(
    provider.extractionStrategy,
    'successfactors-search-results-table+detail-pages+talentcommunity-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.olamgroup.com')
  assert.match(provider.modulePath, /olam[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Olam from the extracted company CSV row', () => {
  const scraper = buildScrapers().find((item) => item.name === 'olam')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /olam[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'olam')

  const report = generateCompanyCoverageReport({
    csvText: 'Olam,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Olam', 'olam', 'Olam']],
  )
})
