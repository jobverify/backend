import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/incred/script.js'

test('InCred resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nInCred\nInCred Money\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['InCred', 'incred', 'InCred']],
  )
})

test('InCred upstream failure is never an unfetched static zero', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw Error('offline') } }), error =>
    error.code === 'INCRED_COVERAGE_GAP' && error.inventoryEvidence.reportedTotal === null)
})
