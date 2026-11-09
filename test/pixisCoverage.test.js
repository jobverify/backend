import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/pixis/script.js'

test('Pixis resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPixis\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pixis', 'pixis', 'Pixis']],
  )
})

test('Pixis does not match similar company names', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPixis AI\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 0)
  assert.deepEqual(report.unmatched.map((item) => item.companyName), ['Pixis AI'])
})

test('Pixis observes its captured official empty listing with deterministic transport', async () => {
  const capture = JSON.parse(readFileSync(new URL('../scraper/pixis/fixtures/careers-response.json', import.meta.url)))
  const jobs = await run({ fetchPage: async url => {
    assert.equal(url, capture.url)
    return { status: capture.status, url: capture.finalUrl, html: capture.body }
  } })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
