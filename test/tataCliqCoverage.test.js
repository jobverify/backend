import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

test('Tata CLiQ resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTata CLiQ\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tata CLiQ', 'tatacliq', 'Tata CLiQ']],
  )
})

test('Tata CLiQ registered scraper reports unavailable coverage instead of verified zero', async () => {
  const scraper = buildScrapers().find((candidate) => candidate.name === 'tatacliq')

  assert.ok(scraper)
  await assert.rejects(scraper.run({fetchImpl:async url=>({status:503,url,text:async()=>''})}),error=>{
    assert.equal(error.code,'TATACLIQ_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.listingComplete,false)
    assert.equal(error.inventoryEvidence.reportedTotal,null)
    return true
  })
})
