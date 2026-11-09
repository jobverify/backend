import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'
import {PROVIDER_METADATA} from '../scraper/boloform/script.js'

const COMPANY_CSV_TEXT = "company_name\nBoloform\n"

test('Boloform coverage matches only its exact configured employer', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'boloform')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nBoloForms\n',
    catalog,
  })

  assert.ok(provider, 'Expected Boloform provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Boloform')
  assert.equal(provider.companyDomain, 'boloform.se')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(PROVIDER_METADATA.verifiedPublicJobCount, null)
  assert.equal(PROVIDER_METADATA.verifiedIndiaJobCount, null)
  assert.equal(PROVIDER_METADATA.lifecycleCleanupAllowed, false)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Boloform').map((item) => item.source),
    ['boloform'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 1)
})

test('Boloform registry scraper exposes upstream failure without advertising verified empty', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'boloform')

  assert.ok(scraper, 'Expected Boloform scraper to be built from its provider extension')
  await assert.rejects(scraper.run({fetchImpl:async()=>{throw new Error('controlled upstream failure')}}),error=>{
    assert.equal(error.code,'BOLOFORM_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.status,'coverage-gap')
    assert.equal(error.inventoryEvidence.reportedTotal,null)
    assert.equal(error.lifecycleCleanupAllowed,false)
    return true
  })
})
