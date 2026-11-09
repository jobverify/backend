import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { HANDOFF_URL, ENTRY_URL } from './native.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const input = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/foreign-country-20261031.json.gz', import.meta.url))))
const replay = (change = body => body) => async url => {
  if (url === HANDOFF_URL) return { url, status: 301, headers: new Headers({ location: ENTRY_URL }) }
  const packet = [input.official, input.entry, input.controlledListing, input.detail].find(packet => packet.url === url)
  assert.ok(packet, 'Unexpected native request: ' + url)
  return { url: packet.finalUrl, status: packet.status, text: async () => packet === input.detail ? change(packet.body) : packet.body }
}

test('an explicit USA country within authoritative International geography remains a foreign role, without a France assumption', async () => {
  const jobs = await run({ fetchImpl: replay() }), native = jobs.nativeCollectionEvidence
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(native.exclusions[0].country, 'United States')
  assert.equal(native.exclusions[0].nativeLocations[0], 'International, USA, Little Rock')
  assert.equal(native.exclusions[0].countryScopeComplete, true)
  assert.equal(native.exactSubsidiaryScopeComplete, false)
})

for (const value of ['International, India, Little Rock', 'International, Remote, Little Rock', 'International, USA and India, Little Rock']) {
  test('unreviewed or conflicting primary geography is never inferred from the US city: ' + value, async () => {
    await assert.rejects(run({ fetchImpl: replay(body => body.replace('International, USA, Little Rock', value)) }), /coverage gap/)
  })
}
