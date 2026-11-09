import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/dassaultaviationindia/script.js'

test('Dassault Aviation India stays exact-name while the sibling Dassault Aviation company resolves separately', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nDassault Aviation India\nDassault Aviation\n',
    catalog,
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName]),
    [
      ['Dassault Aviation India', 'dassaultaviationindia', 'Dassault Aviation India'],
      ['Dassault Aviation', 'dassaultaviation', 'Dassault Aviation'],
    ],
  )
  assert.deepEqual(report.unmatched, [])

  const provider = catalog.find((item) => item.source === 'dassaultaviationindia')
  assert.equal(provider?.exactCompanyMatchOnly, true)
  assert.equal(provider?.companyDomain, 'dassault-aviation.com')
})

test('Dassault Aviation India fails closed without verified public India openings', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),error=>{
    assert.equal(error.code,'DASSAULTAVIATIONINDIA_COVERAGE_GAP')
    assert.equal(error.lifecycleCleanupAllowed,false)
    assert.equal(error.inventoryEvidence.reportedTotal,null)
    return true
  })
})
