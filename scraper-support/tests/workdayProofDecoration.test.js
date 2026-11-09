import assert from 'node:assert/strict'
import test from 'node:test'
import { decorateJobsWithProviderMetadata } from '../providers/index.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF } from '../myworkday/countryInventoryProof.js'
import { resolveZeroJobOutcome } from '../runner.js'

const provider = { source: 'csg', companyName: 'CSG', adapter: 'workday' }
const withProof = jobs => {
  const receipt = { scope: 'complete-board-country-proof', initial: { count: 2, sha256: 'initial' }, closing: { count: 2, sha256: 'closing' }, roles: [] }
  Object.defineProperty(jobs, WORKDAY_COUNTRY_INVENTORY_PROOF, { value: receipt })
  return { jobs, receipt }
}

test('provider decoration preserves the exact native receipt without turning it into inventory evidence', () => {
  const { jobs, receipt } = withProof([])
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.equal(decorated[WORKDAY_COUNTRY_INVENTORY_PROOF], receipt)
  assert.equal(readInventoryEvidence(decorated), null)
  assert.notEqual(resolveZeroJobOutcome({ provider }, decorated, []), 'fetched-zero')
  assert.equal(Object.getOwnPropertyDescriptor(decorated, WORKDAY_COUNTRY_INVENTORY_PROOF).enumerable, false)
})
test('copying an audit receipt cannot upgrade partial evidence or cleanup flags', () => {
  const { jobs, receipt } = withProof([{ title: 'Engineer', sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }])
  attachInventoryEvidence(jobs, { status: 'discovery-only', listingComplete: false, firstParty: true,
    surface: 'https://csgi.wd5.myworkdayjobs.com/CSGCareers', pagesFetched: 1, reportedTotal: 2, indiaFacetCount: null, verifiedAt: '2026-10-26T10:00:00.000Z', reason: 'fixture-partial' })
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.equal(decorated[WORKDAY_COUNTRY_INVENTORY_PROOF], receipt)
  assert.deepEqual(readInventoryEvidence(decorated), readInventoryEvidence(jobs))
  assert.equal(decorated[0].lifecycleCleanupAllowed, false)
})
test('decoration does not invent a Workday proof for an ordinary source', () => {
  const decorated = decorateJobsWithProviderMetadata([{ title: 'Engineer' }], { source: 'example', companyName: 'Example', adapter: 'script' })
  assert.equal(Object.hasOwn(decorated, WORKDAY_COUNTRY_INVENTORY_PROOF), false)
})
