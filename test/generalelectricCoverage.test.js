import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('General Electric resolves through the exact-name first-party provider instead of a speculative sub-brand alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nGeneral Electric\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['General Electric', 'generalelectric', 'General Electric']],
  )
})
