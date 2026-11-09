import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nLetsVenture\n"

test('LetsVenture retains exact original company identity through verified LVX rebrand', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'letsventure')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })

  assert.ok(provider, 'Expected LetsVenture provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'LetsVenture')
  assert.equal(provider.companyDomain, 'lvxventures.com')
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.lifecycleCleanupAllowed,false)
  assert.equal(provider.atsPlatform, 'native-zoho+rebranded-lvx-employer-country-age-unresolved')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'LetsVenture').map((item) => item.source),
    ['letsventure'],
  )
})

test('LetsVenture scraper reports unavailable native coverage without false zero', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'letsventure')

  assert.ok(scraper, 'Expected LetsVenture scraper to be built from its provider extension')
  await assert.rejects(scraper.run({fetchImpl:async()=>{throw Error('offline')}}),e=>e.code==='LETSVENTURE_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&e.lifecycleCleanupAllowed===false)
})
