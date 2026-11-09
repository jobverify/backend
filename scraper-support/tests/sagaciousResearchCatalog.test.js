import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sagacious Research on the verified official current openings page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sagaciousresearch')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sagacious Research')
  assert.equal(provider.companyCareerPage, 'https://sagaciousresearch.com/current-openings')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'sagaciousresearch.com')
  assert.match(provider.modulePath, /sagaciousresearch[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sagacious Research scraper and exact CSV coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sagaciousresearch')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sagaciousresearch[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Sagacious Research\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Sagacious Research', 'sagaciousresearch', 'sagaciousresearch']],
  )
})
