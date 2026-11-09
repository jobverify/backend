import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves the exact Polycab name without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Polycab\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Polycab', 'polycab'],
  ])
})
