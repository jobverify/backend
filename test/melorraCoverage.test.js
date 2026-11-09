import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('Melorra resolves to its exact-name first-party fail-closed provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nMelorra\n',
    catalog: getScraperCatalog(),
  })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Melorra', 'melorra', 'Melorra']],
  )
})
