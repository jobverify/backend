import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Buyhatke as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'buyhatke')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Buyhatke')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://compare.buyhatke.com/company/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'compare.buyhatke.com')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'official-careers-page+first-party-role-pages+google-forms-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /buyhatke[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Buyhatke to the buyhatke source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'buyhatke')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /buyhatke[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'buyhatke')

  const report = generateCompanyCoverageReport({
    csvText: 'Buyhatke,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Buyhatke', 'buyhatke', 'Buyhatke']],
  )
})
