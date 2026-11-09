import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nAvataar\n"

test('Avataar is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'avataar')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nAvataar Technologies\n',
    catalog,
  })

  assert.ok(provider, 'Expected Avataar provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Avataar')
  assert.equal(provider.companyDomain, 'avataar.ai')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'officially-linked-employer-search-unverified-company-scope')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Avataar').map((item) => item.source),
    ['avataar'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 1)
})

test('Avataar registered scraper reports inaccessible recruiting as a coverage gap', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'avataar')

  assert.ok(scraper, 'Expected Avataar scraper to be built from its provider extension')
  await assert.rejects(scraper.run({fetchImpl:async url=>({status:403,url,text:async()=>'<h1>Forbidden</h1>'})}),{code:'AVATAAR_COVERAGE_GAP'})
})
