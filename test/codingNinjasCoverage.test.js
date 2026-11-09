import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run as runNative } from '../scraper/codingninjas/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// Coverage registration is tested separately from native transport availability.
// Preserve the legacy empty-array assertion while requiring an unknown gap.
const run = async () => {
  let attemptedReads = 0
  const jobs = await runNative({
    fetchImpl: async () => { attemptedReads++; throw new Error('Controlled official surface unavailable in coverage fixture') },
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(attemptedReads, 1)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 0)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  return jobs
}

test('Coding Ninjas resolves to its exact-name official Keka provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nCoding Ninjas\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Coding Ninjas', 'codingninjas', 'Coding Ninjas']],
  )
})

test('Coding Ninjas fails closed when its official Keka feed has no public openings', async () => {
  assert.deepEqual(await run(), [])
})
