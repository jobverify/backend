import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nLetsTransport\n"

test('LetsTransport is covered only by its exact first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'letstransport')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nLets Transport\n',
    catalog,
  })

  assert.ok(provider, 'Expected LetsTransport provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'LetsTransport')
  assert.equal(provider.companyDomain, 'letstransport.in')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'LetsTransport').map((item) => item.source),
    ['letstransport'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 1)
})

test('LetsTransport registry scraper reports unavailable inventory without certifying zero', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'letstransport')

  assert.ok(scraper, 'Expected LetsTransport scraper to be built from its provider extension')
  await assert.rejects(scraper.run({ fetchImpl: async url => ({ status: 200, url,
    text: async () => '<h1>LetsTransport</h1><p>Send your resume to recruitment@letstransport.team</p>',
  }) }), error => {
    assert.equal(error.code, 'LETSTRANSPORT_COVERAGE_GAP')
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    return true
  })
})
