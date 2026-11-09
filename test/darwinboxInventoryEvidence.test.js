import test from 'node:test'
import assert from 'node:assert/strict'
import { createDarwinboxScraper } from '../scraper/darwinbox/script.js'
import { attachInventoryEvidence, readInventoryEvidence, isFreshCompleteInventoryEvidence, mapJobsWithInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const record = id => ({ id, title: 'Software Engineer', locations: 'Bengaluru, India', country: 'India', jd: 'Build reliable software.' })
test('Darwinbox complete pagination preserves counts and current inventory evidence', async () => {
  const jobs = await createDarwinboxScraper({ pageSize: 1 }).run({ maxPages: 3,
    fetchListingPage: async ({ page }) => ({ data: [record(String(page))], job_counts: 2 }) })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})
test('Darwinbox page limits, repeated pages and count mismatches cannot certify completeness', async () => {
  for (const [maxPages, fetchListingPage] of [
    [1, async () => ({ data: [record('1')], job_counts: 2 })],
    [2, async () => ({ data: [record('1')], job_counts: 2 })],
    [3, async () => ({ data: [record('1')], job_counts: 3 })],
  ]) {
    const jobs = await createDarwinboxScraper({ pageSize: 1 }).run({ maxPages, fetchListingPage })
    assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false)
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
  }
})
test('Darwinbox explicit empty inventory differs from an upstream failure', async () => {
  const scraper = createDarwinboxScraper()
  const jobs = await scraper.run({ fetchListingPage: async () => ({ data: [], job_counts: 0 }) })
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  const unverified = await scraper.run({ fetchListingPage: async () => ({ data: [] }) })
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(unverified)), false)
  for (const job_counts of ['', false]) await assert.rejects(scraper.run({ fetchListingPage: async () => ({ data: [], job_counts }) }), /malformed|incomplete/)
  await assert.rejects(scraper.run({ fetchListingPage: async () => { throw new Error('unavailable') } }), /unavailable/)
})

test('company mapping preserves empty inventory evidence and downgrades limited results', async () => {
  const scraper = createDarwinboxScraper()
  const empty = await scraper.run({ fetchListingPage: async () => ({ data: [], job_counts: 0 }) })
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(mapJobsWithInventoryEvidence(empty, job => job))), true)
  const jobs = attachInventoryEvidence([record('1')], { ...readInventoryEvidence(empty), status: 'complete-inventory', reportedTotal: 1 })
  const limited = mapJobsWithInventoryEvidence(jobs, job => ({ ...job, sourceListingComplete: false }))
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(limited)), false)
  assert.equal(readInventoryEvidence(mapJobsWithInventoryEvidence([], job => job)), null)
})
