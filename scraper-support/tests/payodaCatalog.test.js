import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Payoda as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'payoda')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Payoda')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.payoda.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'payoda.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /payoda[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Payoda without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'payoda')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /payoda[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'payoda')

  const report = generateCompanyCoverageReport({
    csvText: 'Payoda,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Payoda', 'payoda', 'Payoda']],
  )
})
