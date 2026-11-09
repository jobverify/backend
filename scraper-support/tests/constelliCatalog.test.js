import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Constelli Signals Private Limited is registered with the official careers-page script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'constelli')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Constelli Signals Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.constelli.com/careers/')
  assert.equal(provider.companyDomain, 'constelli.com')
})

test('Constelli Signals Private Limited resolves in company coverage and exposes a runnable scraper', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Constelli Signals Private Limited,,`,
    catalog,
  })
  const scraper = buildScrapers().find((item) => item.name === 'constelli')

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'constelli')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /constelli[\\/]jobs\.json$/)
})
