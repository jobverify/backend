import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog registers Codemonk with its official careers page', () => {
  const catalog = getScraperCatalog()
  const codemonk = catalog.find((provider) => provider.source === 'codemonk')

  assert.ok(codemonk)
  assert.equal(codemonk.companyName, 'Codemonk')
  assert.equal(codemonk.adapter, 'script')
  assert.equal(codemonk.atsPlatform, 'official-company-careers')
  assert.equal(codemonk.companyCareerPage, 'https://codemonk.io/careers')
  assert.equal(codemonk.companyDomain, 'codemonk.io')
  assert.equal(codemonk.paginationStrategy, 'single-static-careers-page')
  assert.equal(codemonk.extractionStrategy, 'html-career-card-links')
})

test('buildScrapers exposes a runnable Codemonk scraper', () => {
  const scrapers = buildScrapers()
  const codemonk = scrapers.find((scraper) => scraper.name === 'codemonk')

  assert.ok(codemonk)
  assert.equal(typeof codemonk.run, 'function')
  assert.match(codemonk.dryRunFile, /codemonk[\\/]jobs\.json$/)
  assert.equal(codemonk.provider.source, 'codemonk')
})

test('company coverage resolves Codemonk and Code Monk to the Codemonk scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Codemonk\n2,Code Monk\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Codemonk', 'codemonk'],
      ['Code Monk', 'codemonk'],
    ],
  )
})
