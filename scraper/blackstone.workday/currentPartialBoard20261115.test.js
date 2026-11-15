import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/experienced-board-20261115.json.gz', import.meta.url))))
const api = 'https://blackstone.wd1.myworkdayjobs.com/wday/cxs/blackstone/Blackstone_Careers/jobs'
const scheduler = { acquire: async () => () => {}, recordRateLimit() {} }
const options = { now: () => '2026-11-15T05:17:00.000Z', requestScheduler: scheduler, retryBaseDelayMs: 0 }
function replay(t, data) {
  const reads = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input?.url || input)
    reads.set(url, (reads.get(url) || 0) + 1)
    let body, type = 'application/json'
    if (url === data.bootstrap.url) { body = data.bootstrap.body; type = 'text/html' }
    else if (url === api) {
      const query = JSON.parse(init.body)
      assert.equal(query.offset, 0)
      assert.deepEqual(query.appliedFacets, {})
      body = JSON.stringify(data.listing)
    } else {
      const packet = data.details.find(packet => packet.url === url)
      assert.ok(packet, 'Only the current captured experienced-board native requests may run: ' + url)
      body = JSON.stringify(packet.payload)
    }
    const response = new Response(body, { status: 200, headers: { 'Content-Type': type } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return reads
}

test('missing cross-board identities retain independently rechecked India roles as a partial experienced-board result', async t => {
  const data = fixture()
  const reads = replay(t, data)
  const jobs = await run(options)
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true
    && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.unverifiedAdditionalBoards[0].site, 'Blackstone_Campus_Careers')
  assert.match(jobs.nativeCollectionEvidence.sourceFullScopeFailure.message, /cross-board complete listing identities unavailable/)
  const assessment = assessSoftFailureAcquisition({ source: 'blackstone', zeroResultPolicy: 'evidence-required' }, jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
  for (const packet of data.details.filter(packet => packet.payload.jobPostingInfo.country.descriptor === 'India')) {
    assert.equal(reads.get(packet.url), 2, 'Reuse the current attempt receipt for the partial pass, then perform a fresh closing read')
  }
})

test('a partial experienced-board zero never certifies the unresolved campus inventory empty', async t => {
  const data = fixture(), foreign = data.details.find(packet => packet.payload.jobPostingInfo.country.descriptor !== 'India')
  data.details = [foreign]
  data.listing.jobPostings = data.listing.jobPostings.filter(row => foreign.url.endsWith(row.externalPath))
  data.listing.total = 1
  replay(t, data)
  const jobs = await run(options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  const assessment = assessSoftFailureAcquisition({ source: 'blackstone', zeroResultPolicy: 'evidence-required' }, jobs)
  assert.equal(assessment.runnerOutcome.success, false)
})

test('a wrong India legal employer still rejects the partial board result', async t => {
  const data = fixture()
  data.details.find(packet => packet.payload.jobPostingInfo.country.descriptor === 'India').payload.hiringOrganization.name = 'Unrelated company'
  replay(t, data)
  await assert.rejects(run(options), /employer/)
})
