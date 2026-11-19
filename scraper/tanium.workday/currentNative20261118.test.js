import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { fixture, greenhousePayload, transport } from '../../scraper-support/tests/corporateFeedFixture20261118.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('Tanium binds current Flight job URLs to its native feed and retains its observed records', async () => {
  const page = fixture('tanium.workday', 'tanium')
  const jobs = await run({ fetchImpl: transport(new Map([[CAREERS_URL, page], ['https://tanium.com/', page],
    ['https://boards-api.greenhouse.io/v1/boards/tanium/jobs?content=true', greenhousePayload('tanium.workday', 'tanium-jobs')]])) })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativeRecords.length, 67)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})
