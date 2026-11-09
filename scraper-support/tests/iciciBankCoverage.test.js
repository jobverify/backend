import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves ICICI Bank Ltd and ICICI Bank without a custom alias entry', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,ICICI Bank Ltd\n2,ICICI Bank\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['ICICI Bank Ltd', 'icicibank'],
    ['ICICI Bank', 'icicibank'],
  ])
})
