import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nUdaan\n"

test('Udaan is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'udaan')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nUdaan Jobs\n',
    catalog,
  })

  assert.ok(provider, 'Expected Udaan provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Udaan')
  assert.equal(provider.companyDomain, 'udaan.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'linkedin-employer-public-board')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Udaan').map((item) => item.source),
    ['udaan'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 1)
})

test('Udaan scraper makes fresh requests and exposes upstream failures as typed coverage gaps', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'udaan')

  assert.ok(scraper, 'Expected Udaan scraper to be built from its provider extension')
  let calls = 0
  await assert.rejects(scraper.run({fetchImpl:async () => {calls++; throw Error('offline')}}), error => {
    assert.equal(error.code, 'UDAAN_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    return true
  })
  assert.equal(calls, 1)
})
