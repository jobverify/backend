import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/kinaracapital/script.js'

test('Kinara Capital resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nKinara Capital\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kinara Capital', 'kinaracapital', 'Kinara Capital']],
  )
})

test('Kinara Capital reports an unavailable public listings feed as incomplete coverage', async () => {
  await assert.rejects(run({ fetchImpl: async () => ({ status: 503 }) }), error => {
    assert.equal(error.code, 'KINARACAPITAL_COVERAGE_GAP')
    assert.equal(error.sourceListingComplete, false)
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    return true
  })
})
