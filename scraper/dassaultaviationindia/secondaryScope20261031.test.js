import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { HANDOFF_URL, ENTRY_URL } from './native.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const input = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/secondary-india-20261031.json.gz', import.meta.url))))
const replay = (change = body => body) => async url => {
  if (url === HANDOFF_URL) return { url, status: 301, headers: new Headers({ location: ENTRY_URL }) }
  const packet = [input.official, input.entry, input.controlledListing, input.detail].find(packet => packet.url === url)
  assert.ok(packet, 'Unexpected native request: ' + url)
  return { url: packet.finalUrl, status: packet.status, text: async () => packet === input.detail ? change(packet.body) : packet.body }
}

test('new France-primary international internship retains unresolved India scope without a role-ID exception', async () => {
  const jobs = await run({ fetchImpl: replay() })
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs), native = jobs.nativeCollectionEvidence
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(native.nativePublicJobCount, 1)
  assert.equal(native.exclusions[0].country, 'France')
  assert.equal(native.exclusions[0].countryScopeComplete, false)
  assert.equal(native.nativeIndiaJobCount, null)
  assert.ok(native.exclusions[0].nativeSecondaryCountryMentions.length > 0)
  assert.equal(native.exactSubsidiaryScopeComplete, false)
})

test('a direct current India location claim cannot be treated as prospective collaboration', async () => {
  await assert.rejects(run({ fetchImpl: replay(body => {
    const changed = body.replace('Notre organisation', 'Poste en Inde. Notre organisation')
    assert.notEqual(changed, body)
    return changed
  }) }), /coverage gap/)
})

test('prospective India text cannot hide conflicting authoritative native geography', async () => {
  await assert.rejects(run({ fetchImpl: replay(body => {
    const changed = body.replace('France, Nouvelle Aquitaine', 'India, Karnataka')
    assert.notEqual(changed, body)
    return changed
  }) }), /coverage gap/)
})
