import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nWizKlub\n"

test('WizKlub resolves exactly to its native brand-filtered provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'wizklub')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })

  assert.ok(provider, 'Expected a WizKlub provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'WizKlub')
  assert.equal(provider.companyDomain, 'wizklub.com')
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.lifecycleCleanupAllowed,false)
  assert.equal(provider.atsPlatform, 'native-employer-linkedin-explicit-brand-parent-roles')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'WizKlub').map((item) => item.source),
    ['wizklub'],
  )
})

test('WizKlub reports unavailable native coverage without false zero', async () => {
  let module
  try {
    module = await import('../scraper/wizklub/script.js')
  } catch {
    module = null
  }

  assert.ok(module, 'Expected WizKlub scraper script')
  assert.equal(typeof module.run, 'function')
  await assert.rejects(module.run({fetchImpl:async()=>{throw Error('offline')}}),e=>e.code==='WIZKLUB_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&e.lifecycleCleanupAllowed===false)
})
