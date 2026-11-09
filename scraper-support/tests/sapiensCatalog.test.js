import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes Sapiens as an current official HiBob script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sapiens')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'hibob')
  assert.equal(provider.companyName, 'Sapiens')
  assert.equal(provider.companyCareerPage, 'https://sapiens.com/careers/')
  assert.equal(provider.companyDomain, 'sapiens.com')
  assert.match(provider.modulePath, /sapiens[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sapiens scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sapiens')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sapiens[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'sapiens')
  assert.equal(scraper.provider.atsPlatform, 'hibob')
})

test('company coverage resolves the exact CSV company name Sapiens without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Sapiens\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Sapiens', 'sapiens']],
  )
  assert.equal(report.unmatchedCount, 0)
})
