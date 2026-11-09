import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/katalon/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const COMPANY_CSV_TEXT = "company_name\nKatalon\n"

test('Katalon resolves only to its exact-name official ATS provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog: getScraperCatalog(),
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nKatalon Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched
      .filter((item) => item.companyName === 'Katalon')
      .map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Katalon', 'katalon', 'Katalon']],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 1)
})

test('Katalon preserves captured recruiting roles and explicit relocation uncertainty', async () => {
  const captures = JSON.parse(readFileSync(new URL('../scraper/katalon/fixtures/careers-responses.json', import.meta.url)))
  captures.push(JSON.parse(readFileSync(new URL('../scraper/katalon/fixtures/official-response.json', import.meta.url))))
  const pages = new Map(captures.map(row => [row.url, row.body]))
  const jobs = await run({ fetchText: async url => {
    assert.ok(pages.has(url), 'request must belong to the captured official flow')
    return pages.get(url)
  } })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && /Vietnam/.test(job.sourceLocationConflict)))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 14)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
