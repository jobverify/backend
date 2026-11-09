import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyPublicInventory } from './publicInventory.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('recognizes the current WordPress Job Manager explicit empty inventory marker', async () => {
  let calls = 0
  const jobs = await verifyPublicInventory(async () => {
    calls++
    return { found_jobs: false, showing: '', max_num_pages: 0,
      html: '\t<li class="no_job_listings_found">There are no listings matching your search.</li>\n' }
  })
  assert.deepEqual(jobs, [])
  assert.equal(calls, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

test('does not treat an unmarked empty response as verified inventory', async () => {
  await assert.rejects(verifyPublicInventory(async () => ({ found_jobs: false, max_num_pages: 0, html: '' })), /explicit no-jobs marker/)
})

test('empty marker cannot override contradictory pagination or job flags', async () => {
  for (const overrides of [{ max_num_pages: 2 }, { found_jobs: true }]) {
    await assert.rejects(verifyPublicInventory(async () => ({ found_jobs: false, max_num_pages: 0,
      html: '<li class="no_job_listings_found">There are no listings matching your search.</li>', ...overrides })), /could not be verified|contradicts the empty inventory/)
  }
})
