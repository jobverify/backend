import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog excludes the retired ADOR provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'ador')

  assert.equal(provider, undefined)
})

test('buildScrapers and company coverage exclude retired ADOR', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'ador')

  assert.equal(provider, undefined)

  const report = generateCompanyCoverageReport({
    csvText: 'ADOR\n',
    catalog: getScraperCatalog(),
  })
  assert.equal(report.matchedCount, 0)
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['ADOR'])
})
