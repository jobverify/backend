import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('Supergrad resolves approved case variants to its exact-name provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSupergrad\nSuperGrad\nSupergrads\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Supergrad', 'supergrad', 'Supergrad'],
      ['SuperGrad', 'supergrad', 'Supergrad'],
    ],
  )
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['Supergrads'])
})

test('Supergrad exposes unknown inventory metadata and uses injected offline transport', async () => {
  const modulePath = new URL('../scraper/supergrad/script.js', import.meta.url)
  assert.equal(existsSync(modulePath), true)

  const { run, PROVIDER_METADATA } = await import(modulePath)
  assert.equal(PROVIDER_METADATA.verifiedPublicJobCount,null)
  assert.equal(PROVIDER_METADATA.verifiedIndiaJobCount,null)
  assert.equal(PROVIDER_METADATA.sourceScopeComplete,false)
  assert.equal(PROVIDER_METADATA.lifecycleCleanupAllowed,false)
  assert.equal(PROVIDER_METADATA.companyDomain,'supergrad.co.in')
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline transport')}}),{code:'SUPERGRAD_COVERAGE_GAP'})
})
