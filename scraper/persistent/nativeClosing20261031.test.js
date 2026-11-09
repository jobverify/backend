import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createPersistentScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/closing-country-conflict-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const SEARCH = 'https://public.zwayam.com/jobs/search'
const DETAIL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
const template = JSON.parse(fixture.packets.find(packet => packet.url === SEARCH).body)
const replay = async ({ removeAtClosing = false, closingUnavailable = false, changeClosingDisplay = false } = {}) => {
  let searches = 0
  return createPersistentScraper({ requestIntervalMs: 0,
    fetchTextImpl: async url => {
      const packet = fixture.packets.find(packet => packet.url === url)
      assert.ok(packet, 'Uncaptured public document: ' + url)
      return { text: packet.body, finalUrl: packet.finalURL }
    },
    fetchJsonImpl: async (url, options = {}) => {
      if (url === SEARCH) {
        const closing = searches++ > 0
        if (closing && closingUnavailable) throw Object.assign(new Error('HTTP 503 closing unavailable'), { status: 503 })
        const rows = structuredClone(closing && removeAtClosing ? fixture.rows.slice(1) : fixture.rows)
        if (closing && changeClosingDisplay) rows[0].locationDisplayForManageJobs = 'Unbound closing office'
        const payload = structuredClone(template)
        Object.assign(payload.data, { data: rows.map(row => ({ _source: row })), totalCount: rows.length, hasMoreData: false })
        // Both actual native text1 facets say India; the second role's own
        // nested offices say Mexico. This is deliberately unresolved scope.
        payload.data.facets.Location = [{ key: 'India', doc_count: rows.length }]
        return payload
      }
      const packet = fixture.packets.find(packet => packet.url === url && (url !== DETAIL
        || JSON.parse(packet.requestBody).jobId === JSON.parse(options.body).jobId))
      assert.ok(packet, 'Uncaptured native request: ' + url)
      return JSON.parse(packet.body)
    },
  }).run()
}

test('complete Persistent closing IDs remove a stale role even when native country scope is contradictory', async () => {
  const jobs = await replay({ removeAtClosing: true })
  assert.equal(jobs.length, 0, 'A missing closing ID must not survive because another role has an unresolved country')
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('identical Persistent closing hashes record stable enumeration without certifying contradictory country scope', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 1)
  const proof = jobs[0].sourceNativeInventory
  assert.equal(proof.initialManifestSha256, proof.closingManifestSha256)
  assert.equal(proof.closingStable, true)
  assert.equal(jobs[0].sourceEnumerationComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(proof.unknownCountries, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.ok(proof.reasons.includes('native-india-facet-distinct-count-mismatch'))
  assert.ok(!proof.reasons.includes('native-closing-ids-count-countries-status-or-content-changed'))
})

test('an unavailable Persistent closing read keeps prior complete details partial and forbids cleanup', async () => {
  const jobs = await replay({ closingUnavailable: true })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceNativeInventory.closingStable, false)
  assert.equal(jobs[0].sourceEnumerationComplete, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('a changed supplied closing display location cannot retain an earlier Persistent detail', async () => {
  const jobs = await replay({ changeClosingDisplay: true })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
