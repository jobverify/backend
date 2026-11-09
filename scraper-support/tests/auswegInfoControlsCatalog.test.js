import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Ausweg Info Controls Pvt Ltd as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ausweginfocontrols')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Ausweg Info Controls Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://ausweginfocontrols.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'ausweginfocontrols.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /ausweginfocontrols[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Ausweg Info Controls Pvt Ltd to the ausweginfocontrols source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ausweginfocontrols')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ausweginfocontrols[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'ausweginfocontrols')

  const report = generateCompanyCoverageReport({
    csvText: 'Ausweg Info Controls Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ausweg Info Controls Pvt Ltd', 'ausweginfocontrols', 'Ausweg Info Controls Pvt Ltd']],
  )
})
