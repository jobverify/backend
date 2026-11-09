import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/unocoin/script.js'

test('Unocoin resolves to its exact-name official provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nUnocoin\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Unocoin', 'unocoin', 'Unocoin']],
  )
})

test('Unocoin fails closed without official enumerable job listings', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('native source unavailable')}}), error => {
    assert.equal(error.code,'UNOCOIN_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.reportedTotal,null)
    assert.equal(error.lifecycleCleanupAllowed,false)
    return true
  })
})
