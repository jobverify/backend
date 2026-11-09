import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes ARMIET Maharashtra as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'armietmaharashtra')

  assert.ok(provider)
  assert.equal(provider.companyName, 'ARMIET Maharashtra')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://armiet.in/career/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'armiet.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /armietmaharashtra[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve ARMIET Maharashtra to the armietmaharashtra source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'armietmaharashtra')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /armietmaharashtra[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'armietmaharashtra')

  const report = generateCompanyCoverageReport({
    csvText: 'ARMIET Maharashtra,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ARMIET Maharashtra', 'armietmaharashtra', 'ARMIET Maharashtra']],
  )
})
