import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { fixture, greenhousePayload, transport } from '../../scraper-support/tests/corporateFeedFixture20261118.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

test('Maven Clinic current renderer configuration binds its feed before selecting India roles', async () => {
  const page = fixture('mavenclinic', 'mavenclinic')
  const jobs = await run({ fetchImpl: transport(new Map([[CAREERS_URL, page], ['https://mavenclinic.com/', page],
    ['https://boards-api.greenhouse.io/v1/boards/mavenclinic/jobs?content=true',
      greenhousePayload('mavenclinic', 'mavenclinic-jobs', { india: true })]])) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].company, 'Maven Clinic')
  assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativeRecords.length, 32)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Maven Clinic generic Remote roles keep native country completeness unresolved', async () => {
  const page = fixture('mavenclinic', 'mavenclinic')
  const jobs = await run({ fetchImpl: transport(new Map([[CAREERS_URL, page],
    ['https://boards-api.greenhouse.io/v1/boards/mavenclinic/jobs?content=true', greenhousePayload('mavenclinic', 'mavenclinic-jobs')]])) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})
