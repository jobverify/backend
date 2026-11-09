import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves the exact H&R Block CSV name without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,H&R Block\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['H&R Block', 'hrblock', 'hrblock']],
  )
  assert.equal(report.unmatchedCount, 0)
})
