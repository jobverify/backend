import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/dailyhunt/script.js'

test('Dailyhunt resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nDailyhunt\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dailyhunt', 'dailyhunt', 'Dailyhunt']],
  )
})

test('Dailyhunt unavailable official recruiting cannot authorize an empty inventory', async () => {
  await assert.rejects(run({fetchImpl:async url=>({url,status:503})}), error=>{
    assert.equal(error.code,'DAILYHUNT_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.reportedTotal,null)
    assert.equal(error.lifecycleCleanupAllowed,false)
    return true
  })
})
