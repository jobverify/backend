import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/ayefinance/script.js'

test('Aye Finance resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nAye Finance\nAye Finance India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aye Finance', 'ayefinance', 'Aye Finance']],
  )
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['Aye Finance India'])
})

test('Aye Finance unavailable native recruiting cannot certify an empty inventory', async () => {
  await assert.rejects(run({fetchImpl: async url => ({url, status:503})}), error => {
    assert.equal(error.code, 'AYEFINANCE_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.lifecycleCleanupAllowed, false)
    return true
  })
})
