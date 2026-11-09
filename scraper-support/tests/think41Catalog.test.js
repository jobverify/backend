import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes Think41 as an official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'think41')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Think41')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.think41.com/careers2')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'think41.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /think41[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Think41 without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'think41')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'think41')
  assert.match(scraper.dryRunFile, /think41[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Think41\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Think41', 'think41', 'think41']],
  )
  assert.equal(report.unmatchedCount, 0)
})
