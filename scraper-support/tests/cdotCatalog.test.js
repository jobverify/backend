import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('C-DOT is registered as an official current-openings scraper and resolves its coverage name', () => {
  const catalog = getScraperCatalog()
  const cdot = catalog.find((provider) => provider.source === 'cdot')

  assert.ok(cdot)
  assert.equal(cdot.adapter, 'script')
  assert.equal(cdot.atsPlatform, 'official-company-careers')
  assert.equal(cdot.companyCareerPage, 'https://cdot.in/cdotweb/web/current_openings.php?lang=en')
  assert.equal(cdot.companyDomain, 'cdot.in')
  assert.match(cdot.modulePath, /cdot[\\/]script\.js$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,Centre for Development of Telematics (C-DOT),,\n2,C-DOT,,',
    catalog,
  })
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Centre for Development of Telematics (C-DOT)', 'cdot'],
    ['C-DOT', 'cdot'],
  ])
})

test('buildScrapers exposes a runnable C-DOT scraper', () => {
  const cdot = buildScrapers().find((scraper) => scraper.name === 'cdot')

  assert.ok(cdot)
  assert.equal(typeof cdot.run, 'function')
  assert.match(cdot.dryRunFile, /cdot[\\/]jobs\.json$/)
})
