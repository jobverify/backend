import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run, PROVIDER_METADATA } from '../scraper/yournest/script.js'

test('YourNest resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nYourNest\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['YourNest', 'yournest', 'YourNest']],
  )
})

test('YourNest fails closed with injected transport when inventory is unavailable', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}), error=>(
    error.code==='YOURNEST_COVERAGE_GAP' && error.lifecycleCleanupAllowed===false
    && error.inventoryEvidence.reportedTotal===null
  ))
  assert.equal(PROVIDER_METADATA.atsPlatform,'pyjamahr-native-anonymous-api')
  assert.equal(PROVIDER_METADATA.sourceListingComplete,false)
  assert.equal(PROVIDER_METADATA.verifiedPublicJobCount,null)
})
