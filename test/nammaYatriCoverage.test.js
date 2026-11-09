import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/nammayatri/script.js'

test('Namma Yatri resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nNamma Yatri\nMoving Tech Innovations Private Limited\nJuspay\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched
      .filter((item) => item.companyName === 'Namma Yatri')
      .map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Namma Yatri', 'nammayatri', 'Namma Yatri']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Moving Tech Innovations Private Limited'],
  )
})

test('Namma Yatri reports unavailable native coverage without a false zero', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),error=>error.code==='NAMMAYATRI_COVERAGE_GAP'&&error.inventoryEvidence.reportedTotal===null&&error.lifecycleCleanupAllowed===false)
})
