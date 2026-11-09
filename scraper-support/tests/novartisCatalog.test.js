import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Novartis as an exact-name first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'novartis')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Novartis')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.novartis.com/careers/career-search/tag/LOC_IN')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'tag-page-query-pagination')
  assert.equal(provider.extractionStrategy, 'first-party-html-job-table')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'novartis.com')
  assert.match(provider.modulePath, /novartis[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Novartis rows without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'novartis')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /novartis[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'novartis')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Novartis\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Novartis', 'novartis', 'Novartis']],
  )
})
