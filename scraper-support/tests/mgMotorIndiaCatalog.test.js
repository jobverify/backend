import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes MG Motor India as a Darwinbox-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mgmotorindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'MG Motor India')
  assert.equal(provider.companyCareerPage, 'https://www.mgmotor.co.in/careers')
  assert.equal(provider.companyDomain, 'mgmotor.co.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /mgmotorindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable MG Motor India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mgmotorindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /mgmotorindia[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves Morris Garages India backlog variants to the MG Motor India provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Morris Garages India,\nMG Motor India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Morris Garages India', 'mgmotorindia', 'MG Motor India'],
      ['MG Motor India', 'mgmotorindia', 'MG Motor India'],
    ],
  )
})
