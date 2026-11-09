import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Everlife CPC as an official careers page scraper with Darwinbox apply handoffs', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'everlifecpc')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Everlife CPC')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-plus-darwinbox-handoff')
  assert.equal(provider.companyCareerPage, 'https://cpcdiagnostics.in/career')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'cpcdiagnostics.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /everlifecpc[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Everlife CPC to the everlifecpc source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'everlifecpc')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /everlifecpc[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'everlifecpc')

  const report = generateCompanyCoverageReport({
    csvText: 'Everlife CPC,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Everlife CPC', 'everlifecpc', 'Everlife CPC']],
  )
})
