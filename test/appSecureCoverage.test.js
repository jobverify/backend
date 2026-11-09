import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('AppSecure resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nAppSecure\nAppSure\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AppSecure', 'appsecure', 'AppSecure']],
  )
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['AppSure'])
})

test('AppSecure source transport failure cannot certify empty inventory', async () => {
  const modulePath = new URL('../scraper/appsecure/script.js', import.meta.url)
  assert.equal(existsSync(modulePath), true)

  const { run } = await import(modulePath)
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),error=>error.code==='APPSECURE_COVERAGE_GAP'&&error.inventoryEvidence.reportedTotal===null&&error.lifecycleCleanupAllowed===false)
})
