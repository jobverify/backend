import test from 'node:test'
import assert from 'node:assert/strict'
import {createBitwiseSolutionsScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {networkFences, originalPacket, replay} from './fixtures/currentReviewedReplay20261121.js'

test('actual own listings and full roles yield conservative partials; offline closing reuse is explicitly simulated', async t => {
  const restore = networkFences(); t.after(restore)
  const transport = replay()
  let jobs
  try {
    jobs = await createBitwiseSolutionsScraper().run({fetchText: transport.fetchText, fetchImpl: transport.fetchImpl, requestIntervalMs: 0, now: () => originalPacket.completedAt})
  } finally {
    t.diagnostic(JSON.stringify({genuineOpeningOriginals: 9, capturedClosingOriginals: 0, nativeReplayRequests: transport.calls.length, realLegacyBodyReads: transport.legacyTextCalls, closingEvidenceTruth: transport.evidenceTruth}))
  }
  assert.deepEqual(jobs.map(job => job.nativePublicJobId).sort(), ['6061', '6065', '6085'])
  for (const job of jobs) {
    assert.equal(job.nativeEmployer, 'Bitwise')
    assert.equal(job.sourceNativePublisher, 'Bitwise')
    assert.equal(job.company, 'Bitwise Solutions')
    assert.equal(job.country, 'India')
    assert.equal(job.city, null)
    assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.postingDate, null)
    assert.equal(job.closingDate, null)
    assert.equal(job.requisitionId, null)
    assert.equal(job.sourceDetailStatus, 'partial')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceNativeRoleModels.length, 2)
    assert.ok(job.sourceDescription)
  }
  assert.equal(transport.calls.length, 24)
  assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.length, 5)
  assert.equal(jobs.nativeCollectionEvidence.nativeClosingInventory.length, 5)
  assert.ok(jobs.nativeCollectionEvidence.held.some(role => role.id === '6211'))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})
