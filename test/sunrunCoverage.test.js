import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { replay } from '../scraper/sunrun/fixtureReplay.js'
import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const COMPANY_CSV_TEXT = "company_name\nSunrun\n"

test('Sunrun is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'sunrun')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nSun Run\nSunrun Solar\n',
    catalog,
  })

  assert.ok(provider, 'Expected Sunrun provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Sunrun')
  assert.equal(provider.companyDomain, 'sunrun.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.match(provider.modulePath, /[\\/]sunrun[\\/]script\.js$/)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Sunrun').map((item) => item.source),
    ['sunrun'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Sunrun scraper enumerates captured public Workday inventory deterministically', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'sunrun')

  assert.ok(scraper, 'Expected Sunrun scraper to be built from its provider extension')
  const jobs = await scraper.run(replay())
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 254)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})
