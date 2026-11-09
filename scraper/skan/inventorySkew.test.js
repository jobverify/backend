import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))))
const active = JSON.parse(readFileSync(new URL('./fixtures/additional-native-api-pages.json', import.meta.url)))[0]
const packets = [read('careers-response'), ...read('detail-responses')]
test('Skan retains reconciled roles when its active API advertises a newer role absent from the cached corporate listing', async () => {
  const records = JSON.parse(active.body), newRole = { ...structuredClone(records[0]), id: 999999999, title: 'New native role' }
  const requested = []
  const jobs = await run({ now: active.capturedAt, fetchText: async url => {
    requested.push(url)
    return url === active.url ? JSON.stringify([...records, newRole]) : packets.find(packet => packet.url === url)?.body
  } })
  assert.equal(jobs.length, 16)
  assert.equal(jobs.some(job => job.jobId === String(newRole.id)), false)
  assert.equal(requested.some(url => url.endsWith(String(newRole.id))), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reason, 'native-active-listing-count-disagreement')
})
