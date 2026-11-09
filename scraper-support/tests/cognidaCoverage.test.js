import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves Cognida.ai naming variants to the Cognida scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Cognida.ai\n2,Cognida AI\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Cognida.ai', 'cognida'], ['Cognida AI', 'cognida']],
  )
  assert.equal(report.unmatchedCount, 0)
})
