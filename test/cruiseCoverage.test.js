import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = path.join(backendDir, 'scraper-support/providers/providerExtensions/cruise.json')
const csvText = "company_name\nCruise\n"

test('Cruise exact provider extension covers only the literal CSV company row', () => {
  assert.equal(existsSync(extensionPath), true)

  const provider = JSON.parse(readFileSync(extensionPath, 'utf8'))
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: csvText,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nCruise India\nCruise Automation\n',
    catalog,
  })

  assert.equal(provider.companyName, 'Cruise')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'first-party-careers-coverage-gap')
  assert.deepEqual(
    report.matched.filter(({ companyName }) => companyName === 'Cruise').map((item) => item.source),
    ['cruise'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Cruise registered scraper reports a coverage gap without a verified enumerable contract', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'cruise')

  assert.ok(scraper, 'Expected Cruise scraper to be built from its provider extension')
  await assert.rejects(scraper.run({ fetchImpl: async () => ({ status: 502 }) }), error => {
    assert.equal(error.code, 'CRUISE_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    return true
  })
})
