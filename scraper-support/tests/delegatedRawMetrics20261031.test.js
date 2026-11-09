import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { extractionRawJobMetrics } from '../utils/extractionRawJobMetrics.js'
import { attachInventoryDelegationEvidence } from '../utils/inventoryDelegationEvidence.js'

const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/auth0/test-data/delegation-20261031.json.gz', import.meta.url)))).packets
const provider = { source: 'auth0', inventoryDelegation: { verified: true, sources: ['okta'], preservesChildSourceAndCompany: true } }
const proof = () => ({ source: 'auth0', sources: ['okta'], preservesChildSourceAndCompany: true,
  verifiedAt: packets[0].capturedAt, evidence: { method: 'official-careers-redirect', url: packets[0].url,
    responses: packets.map(p => ({ url: p.url, finalUrl: p.finalUrl, status: p.status, sha256: p.sha256 })) } })
const jobs = () => [{ source: 'okta', nativeCollectionEvidence: { source: 'okta', observedListingCount: 389 } }]

test('canonical wrapper raw diagnostics retain observed native rows rather than substituting the returned India subset', () => {
  // Controlled one-role boundary isolates counting;389 is an observed listing
  // count and does not become a reported upstream or India inventory total.
  const observations = attachInventoryDelegationEvidence(jobs(), proof())
  assert.deepEqual(extractionRawJobMetrics(provider, observations, null), {
    rawJobs: 389, rawJobsBasis: 'observed-canonical-native-listing-rows',
  })
})

test('a historical declaration without a matching runtime relationship cannot borrow another source count', () => {
  assert.equal(extractionRawJobMetrics(provider, jobs(), null).rawJobs, 1)
})

for (const [label, mutate] of [
  ['wrong wrapper', p => { p.source = 'carrierglobal' }],
  ['wrong declared child', p => { p.inventoryDelegation.sources = ['carrier'] }],
  ['unqualified ownership preservation', p => { p.inventoryDelegation.preservesChildSourceAndCompany = false }],
]) test(`delegated raw metrics cannot use a ${label}`, () => {
  const candidate = structuredClone(provider);mutate(candidate)
  assert.equal(extractionRawJobMetrics(candidate, attachInventoryDelegationEvidence(jobs(), proof()), null).rawJobs, 1)
})

test('mixed child jobs cannot be described by the first native collection count', () => {
  const observations = attachInventoryDelegationEvidence([...jobs(), { source: 'carrier' }], proof())
  assert.equal(extractionRawJobMetrics(provider, observations, null).rawJobs, 2)
})

test('multi-child delegation does not substitute the first child count for a combined source', () => {
  const candidate = { ...provider, inventoryDelegation: { ...provider.inventoryDelegation, sources: ['okta','carrier'] } }
  const observed = { ...proof(), sources: ['okta','carrier'] }
  assert.equal(extractionRawJobMetrics(candidate, attachInventoryDelegationEvidence(jobs(), observed), null).rawJobs, 1)
})

test('a qualified canonical native count below the returned subset remains an explicit diagnostic conflict', () => {
  const observations = jobs();observations[0].nativeCollectionEvidence.observedListingCount = 0
  const result = extractionRawJobMetrics(provider, attachInventoryDelegationEvidence(observations, proof()), null)
  assert.equal(result.rawJobs, 1)
  assert.equal(result.rawJobsCountConflict, true)
})
