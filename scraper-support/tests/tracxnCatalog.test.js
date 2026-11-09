import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Tracxn Technologies Limited as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tracxn')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tracxn Technologies Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://w.tracxn.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'w.tracxn.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /tracxn[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Tracxn Technologies Limited to the tracxn source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tracxn')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tracxn[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tracxn')

  const report = generateCompanyCoverageReport({
    csvText: 'Tracxn Technologies Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tracxn Technologies Limited', 'tracxn', 'Tracxn Technologies Limited']],
  )
})
