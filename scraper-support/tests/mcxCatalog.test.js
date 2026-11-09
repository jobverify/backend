import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('MCX is registered against the verified first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mcx')

  assert.ok(provider)
  assert.equal(provider.companyName, 'MCX')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.mcxindia.com/careers/job-openings')
  assert.equal(provider.companyDomain, 'mcxindia.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicJobCount, 5)
})

test('MCX resolves in company coverage and exposes a runnable scraper', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,MCX,,`,
    catalog,
  })
  const scraper = buildScrapers().find((item) => item.name === 'mcx')

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'mcx')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mcx[\\/]jobs\.json$/)
})
