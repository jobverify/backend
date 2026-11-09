import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('Questt resolves only to its exact-name provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nQuestt\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Questt', 'questt', 'Questt']],
  )
  assert.equal(report.unmatchedCount, 0)
})

test('Questt registration exposes honest candidate metadata and injects offline transport', async () => {
  const modulePath = new URL('../scraper/questt/script.js', import.meta.url)
  assert.equal(existsSync(modulePath), true)

  const { run, PROVIDER_METADATA } = await import(modulePath)
  assert.equal(PROVIDER_METADATA.verifiedPublicJobCount, null)
  assert.equal(PROVIDER_METADATA.verifiedIndiaJobCount, null)
  assert.equal(PROVIDER_METADATA.sourceScopeComplete, false)
  assert.equal(PROVIDER_METADATA.lifecycleCleanupAllowed, false)
  assert.equal(PROVIDER_METADATA.officialBrandName, 'Questt AI')
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline transport')}}),{code:'QUESTT_COVERAGE_GAP'})
})
