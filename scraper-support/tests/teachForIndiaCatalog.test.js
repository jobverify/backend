import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Teach For India as an official Salesforce careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'teachforindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Teach For India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.teachforindia.org/work-with-us')
  assert.equal(provider.atsPlatform, 'salesforce-sites')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-remoting-request')
  assert.equal(
    provider.extractionStrategy,
    'official-handoff+salesforce-sites-remoting+detail-pages+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'teachforindia.org')
  assert.match(provider.modulePath, /teachforindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Teach For India to the teachforindia source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'teachforindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /teachforindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'teachforindia')

  const report = generateCompanyCoverageReport({
    csvText: 'Teach For India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Teach For India', 'teachforindia', 'Teach For India']],
  )
})
