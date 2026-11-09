import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nLucid Motors\n"

test('Lucid Motors is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'lucidmotors')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nLucid Motor\nLucid Automotive\n',
    catalog,
  })

  assert.ok(provider, 'Expected Lucid Motors provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Lucid Motors')
  assert.equal(provider.companyDomain, 'lucidmotors.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Lucid Motors').map((item) => item.source),
    ['lucidmotors'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Lucid Motors provider retains live native no-India inventory evidence', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'lucidmotors')

  assert.ok(scraper, 'Expected Lucid Motors scraper to be built from its provider extension')
  const fixture = name => JSON.parse(gunzipSync(readFileSync(new URL(`../scraper/lucidmotors/fixtures/${name}.json.gz`, import.meta.url))))
  const responses = [fixture('search-response'), ...fixture('client-api-responses'), ...fixture('native-responses')]
  const jobs = await scraper.run({ fetchImpl: async url => {
    const response = responses.find(row => row.url === url)
    if (!response) throw new Error('Unrecorded unrelated client script')
    return { status: response.status, url, text: async () => response.body, json: async () => JSON.parse(response.body) }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 445)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})
