import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Adani Group current native Oracle collector with runtime-only inventory', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'adani')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-hcm')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.companyCareerPage, 'https://www.adani.com/careers')
  assert.equal(provider.companyDomain, 'adani.com')
  assert.match(provider.modulePath, /adani[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Adani Group scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'adani')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'oracle-hcm')
  assert.match(provider.dryRunFile, /adani[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves Adani subsidiaries already covered by the Adani Group careers surface', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Adani Enterprises,\nAdani Green Energy,\nAdani Ports,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [
      ['Adani Enterprises', 'adani', 'Adani Group'],
      ['Adani Green Energy', 'adani', 'Adani Group'],
      ['Adani Ports', 'adani', 'Adani Group'],
    ],
  )
})
