import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Conserve Solutions is registered with its official public jobs-page script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'conservesolutions')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Conserve Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.conservesolution.com/jobs')
  assert.equal(provider.companyDomain, 'conservesolution.com')
})

test('Conserve Solutions resolves in company coverage and exposes a runnable scraper', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Conserve Solutions,,`,
    catalog,
  })
  const scraper = buildScrapers().find((item) => item.name === 'conservesolutions')

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'conservesolutions')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /conservesolutions[\\/]jobs\.json$/)
})
