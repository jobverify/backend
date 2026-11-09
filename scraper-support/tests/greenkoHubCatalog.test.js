import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog excludes the retired Greenko Hub provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'greenkohub')

  assert.equal(provider, undefined)
})

test('buildScrapers and company coverage exclude retired Greenko Hub', () => {
  const scraper = buildScrapers().find((item) => item.name === 'greenkohub')

  assert.equal(scraper, undefined)

  const report = generateCompanyCoverageReport({
    csvText: 'Greenko Hub,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 0)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Greenko Hub'],
  )
})
