import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Campus Sutra through its public company hiring page', () => {
  const catalog = getScraperCatalog()
  const campusSutra = catalog.find((provider) => provider.source === 'campussutra')

  assert.ok(campusSutra)
  assert.equal(campusSutra.companyName, 'Campus Sutra')
  assert.equal(campusSutra.adapter, 'script')
  assert.equal(campusSutra.atsPlatform, 'linkedin-guest-search')
  assert.equal(campusSutra.companyCareerPage, 'https://in.linkedin.com/company/campus-sutra')
  assert.equal(campusSutra.companyDomain, 'campussutra.com')
  assert.equal(campusSutra.paginationStrategy, 'current-native-employer-profile-and-configured-guest-search-observations+closing-models')
  assert.equal(campusSutra.extractionStrategy, 'exact-native-organization-identity+complete-original-announcements+explicit-unqualified-keyword-search;no-country-or-vacancy-zero-inference')
})

test('buildScrapers exposes a runnable Campus Sutra scraper', () => {
  const scrapers = buildScrapers()
  const campusSutra = scrapers.find((scraper) => scraper.name === 'campussutra')

  assert.ok(campusSutra)
  assert.equal(typeof campusSutra.run, 'function')
  assert.match(campusSutra.dryRunFile, /campussutra[\\/]jobs\.json$/)
})

test('company coverage resolves Campus Sutra to its scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Campus Sutra\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Campus Sutra', 'campussutra'],
  ])
})
