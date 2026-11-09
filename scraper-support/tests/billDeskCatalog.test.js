import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BillDesk on the verified official first-party careers SPA', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'billdesk')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BillDesk')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.billdesk.com/web/careers')
  assert.equal(provider.companyDomain, 'billdesk.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-first-party-spa-bundle')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+first-party-bundle+embedded-openings+detail-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /billdesk[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BillDesk without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'billdesk')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /billdesk[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'billdesk')

  const report = generateCompanyCoverageReport({
    csvText: 'BillDesk,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BillDesk', 'billdesk', 'BillDesk']],
  )
})
