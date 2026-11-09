import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/moneytap/script.js'

test('MoneyTap resolves to its exact-name official ATS-backed provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nMoneyTap\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MoneyTap', 'moneytap', 'MoneyTap']],
  )
})

test('MoneyTap verifies its captured current native empty inventory', async () => {
  const capture = JSON.parse(readFileSync(new URL('../scraper/moneytap/fixtures/careers-response.json', import.meta.url)))
  const jobs = await run({ fetchPage: async () => ({ status: capture.status, url: capture.finalUrl, html: capture.body }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
