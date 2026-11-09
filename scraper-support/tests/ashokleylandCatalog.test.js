import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog excludes the retired Ashok Leyland provider', () => {
  const catalog = getScraperCatalog()
  const ashokLeyland = catalog.find((provider) => provider.source === 'ashokleyland')

  assert.equal(ashokLeyland, undefined)
})

test('buildScrapers and company coverage exclude retired Ashok Leyland', () => {
  const scrapers = buildScrapers()
  const ashokLeyland = scrapers.find((scraper) => scraper.name === 'ashokleyland')

  assert.equal(ashokLeyland, undefined)

  const report = generateCompanyCoverageReport({
    csvText: 'Ashok Leyland\n',
    catalog: getScraperCatalog(),
  })
  assert.equal(report.matchedCount, 0)
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['Ashok Leyland'])
})
