import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/waycool/script.js'

test('WayCool resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nWayCool\nWayCool Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['WayCool', 'waycool', 'WayCool']],
  )
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['WayCool Technologies'])
})

test('WayCool reports unavailable official recruiting as a coverage gap', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),{code:'WAYCOOL_COVERAGE_GAP'})
})
