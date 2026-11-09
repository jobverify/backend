import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/carehealthinsurance/script.js'

test('Care Health Insurance resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nCare Health Insurance\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Care Health Insurance', 'carehealthinsurance', 'Care Health Insurance']],
  )
})

test('Care Health Insurance selected-area sentinel cannot authorize an empty company inventory', async () => {
  await assert.rejects(run({fetchImpl:async url => ({url, status:200,
    text:async () => 'No opening in this area. Please check after sometime.'})}), error => {
    assert.equal(error.code, 'CAREHEALTHINSURANCE_COVERAGE_GAP')
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    return true
  })
})
