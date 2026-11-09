import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/aurorainnovation/script.js'

test('Aurora Innovation resolves only to its exact-name official provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nAurora Innovation\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aurora Innovation', 'aurorainnovation', 'Aurora Innovation']],
  )
  assert.equal(report.unmatchedCount, 0)
})

test('Aurora Innovation verifies the captured global inventory before reporting no India roles', async () => {
  const capture = JSON.parse(readFileSync(new URL('../scraper/aurorainnovation/fixtures/jobs-response.json', import.meta.url)))
  const jobs = await run({ fetchJson: async () => JSON.parse(capture.body) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 98)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
