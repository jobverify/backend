import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Cientra stays unmatched after its parent provider is removed', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,Cientra,,',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(report.matched, [])
})
