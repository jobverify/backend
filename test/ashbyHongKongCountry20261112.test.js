import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'

const payload = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/airwallex-current-native-inventory-20261112.json.gz', import.meta.url))))
const replay = async (t, mutate) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network request'))
  const current = structuredClone(payload)
  mutate?.(current)
  return buildScrapers().find(row => row.name === 'airwallex').run({fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/airwallex')
    return current
  }})
}

test('Airwallex native Hong Kong postal country does not invalidate the complete 482-role inventory', async t => {
  const jobs = await replay(t)
  assert.equal(jobs.length, 8)
  assert.ok(jobs.every(job => job.country === 'India'))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 482)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 8)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

test('an unknown native postal country remains incomplete beside the Hong Kong office label', async t => {
  const jobs = await replay(t, current => {
    const role = current.jobs.find(job => job.address?.postalAddress?.addressCountry === 'Hong Kong')
    assert.ok(role)
    role.address.postalAddress.addressCountry = 'Unverified territory'
  })
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

test('a Hong Kong native office cannot be relabelled as an India worksite', async t => {
  await assert.rejects(replay(t, current => {
    const role = current.jobs.find(job => job.address?.postalAddress?.addressCountry === 'Hong Kong')
    assert.ok(role)
    role.location = 'India'
  }), /contradictory country\/location/)
})
