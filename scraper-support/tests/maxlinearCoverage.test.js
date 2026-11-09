import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves the exact MaxLinear CSV name without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,MaxLinear\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['MaxLinear', 'maxlinear', 'maxlinear']],
  )
  assert.equal(report.unmatchedCount, 0)
})

test('company coverage resolves the current Max Linear backlog spelling via alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Max Linear\n',
    catalog: getScraperCatalog(),
    aliasMap: {
      'Max Linear': 'maxlinear',
    },
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Max Linear', 'maxlinear', 'maxlinear']],
  )
  assert.equal(report.unmatchedCount, 0)
})
