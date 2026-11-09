import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves Dhanalaxmi Bank and Dhanlaxmi Bank to the official scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Dhanalaxmi Bank\n2,Dhanlaxmi Bank\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Dhanalaxmi Bank', 'dhanalaxmibank'],
    ['Dhanlaxmi Bank', 'dhanalaxmibank'],
  ])
})
