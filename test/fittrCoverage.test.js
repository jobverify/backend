import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/fittr/script.js'

test('Fittr resolves approved case variants to its literal exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nFittr\nFITTR\nFittr Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Fittr', 'fittr', 'Fittr'],
      ['FITTR', 'fittr', 'Fittr'],
    ],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Fittr Technologies'],
  )
})

test('Fittr fails closed with typed unknown coverage when the native source is unavailable', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('unavailable')}}),{
    code:'FITTR_COVERAGE_GAP',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  })
})
