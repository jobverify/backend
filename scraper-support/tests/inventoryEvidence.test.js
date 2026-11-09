import assert from 'node:assert/strict'
import test from 'node:test'

import {
  attachInventoryEvidence,
  isVerifiedEmptyEvidence,
  normalizeInventoryEvidence,
  readInventoryEvidence,
} from '../utils/inventoryEvidence.js'

test('inventory evidence is attached without changing the jobs array contract', () => {
  const jobs = attachInventoryEvidence([], {
    status: 'verified-empty',
    surface: 'https://example.test/jobs',
    firstParty: true,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: '2026-09-13T00:00:00.000Z',
    reason: 'validated-empty-response',
  })

  assert.equal(Array.isArray(jobs), true)
  assert.deepEqual([...jobs], [])
  assert.deepEqual(Object.keys(jobs), [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'verified-empty',
    surface: 'https://example.test/jobs',
    firstParty: true,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: '2026-09-13T00:00:00.000Z',
    reason: 'validated-empty-response',
  })
})

test('verified empty requires complete current first-party HTTP evidence', () => {
  const valid = {
    status: 'verified-empty',
    surface: 'https://example.test/jobs',
    firstParty: true,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: '2026-09-13T00:00:00.000Z',
    reason: 'validated-empty-response',
  }

  assert.equal(isVerifiedEmptyEvidence(valid), true)
  assert.equal(isVerifiedEmptyEvidence({ ...valid, firstParty: false }), false)
  assert.equal(isVerifiedEmptyEvidence({ ...valid, listingComplete: false }), false)
  assert.equal(isVerifiedEmptyEvidence({ ...valid, surface: 'mailto:jobs@example.test' }), false)
  assert.equal(isVerifiedEmptyEvidence({ ...valid, reportedTotal: 2 }), false)
  assert.equal(isVerifiedEmptyEvidence({ ...valid, verifiedAt: 'not-a-date' }), false)
})

test('normalization converts malformed evidence into an unverified result', () => {
  assert.deepEqual(normalizeInventoryEvidence({
    status: 'verified-empty',
    surface: 'not a URL',
    firstParty: true,
    listingComplete: true,
  }), {
    status: 'unverified',
    surface: null,
    firstParty: false,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: null,
    reason: 'invalid-inventory-evidence',
  })
})

test('inventory evidence rejects non-array values', () => {
  assert.throws(
    () => attachInventoryEvidence({}, { status: 'unverified' }),
    /jobs array/i,
  )
})
