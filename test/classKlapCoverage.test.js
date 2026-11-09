import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/classklap/script.js'

test('ClassKlap resolves only to its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nClassKlap\nClass Klap\n',
    catalog,
  })

  const provider = catalog.find((item) => item.source === 'classklap')

  assert.ok(provider)
  assert.equal(provider.companyName, 'ClassKlap')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.companyDomain, 'classklap.com')
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['ClassKlap', 'classklap']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Class Klap'],
  )
})

test('ClassKlap reports unavailable native coverage without false zero', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),e=>e.code==='CLASSKLAP_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&e.lifecycleCleanupAllowed===false)
})
