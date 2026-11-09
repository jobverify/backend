import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nSamsung\n"

test('Samsung is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'samsung')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nSamsung Research\nSamsung Semiconductor India\n',
    catalog,
  })

  assert.ok(provider, 'Expected Samsung provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Samsung')
  assert.equal(provider.companyDomain, 'samsung.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'workday-public-cxs')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Samsung').map((item) => item.source),
    ['samsung'],
  )
  assert.deepEqual(
    nearNameReport.matched.map((item) => [item.companyName, item.source]),
    [
      ['Samsung Research', 'samsungresearch'],
      ['Samsung Semiconductor India', 'samsungresearch'],
    ],
  )
})

test('Samsung registered scraper rejects unavailable native recruiting', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'samsung')

  assert.ok(scraper, 'Expected Samsung scraper to be built from its provider extension')
  await assert.rejects(scraper.run({fetchImpl:async url=>({status:503,url,text:async()=>''})}))
})
