import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import * as current from './currentPublished20261120.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publication-20261120.json.gz', import.meta.url))))
const replay = (modify = record => record) => {
  let calls = 0
  return {
    calls: () => calls,
    fetchImpl: async (url, request) => {
      const original = fixture.responses[calls++]
      assert.ok(original, 'No unbound/native extra request')
      assert.equal(String(url), original.requestedUrl, 'Exact declared native chronology')
      assert.equal(request.method, original.method)
      assert.equal(request.body, original.originalRequestBody)
      const record = modify(structuredClone(original), calls)
      const response = new Response(Buffer.from(record.bodyBase64, 'base64'), { status: record.status, headers: record.headers })
      Object.defineProperty(response, 'url', { value: original.requestedUrl })
      return response
    }
  }
}
const collect = options => { assert.equal(typeof current.runCurrentPublished, 'function', 'Missing current native collector'); return current.runCurrentPublished({ now: fixture.completedAt, requestIntervalMs: 0, ...options }) }

test('two complete current India scopes and paired native details produce75 partials without applying', async () => {
  const io = replay()
  const jobs = await collect({ fetchImpl: io.fetchImpl })
  assert.equal(io.calls(), 174)
  assert.equal(jobs.length, 75)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === false && job.jobDescription && job.sourceLegalEmployer === null && job.requisitionId === null && job.sourceClosingReconciled && job.sourceNativeRoleClosingQualified && !job.backendApplicationActivationVerified && !job.lifecycleCleanupAllowed))
  assert.ok(!jobs.some(job => job.nativePublicJobId === '24195'))
  assert.equal(jobs.nativeCollectionEvidence.openingPublication.pages.length, 9)
  assert.equal(jobs.nativeCollectionEvidence.closingPublication.pages.length, 9)
  assert.equal(jobs.nativeCollectionEvidence.openingPublication.observedCards, 76)
  assert.equal(jobs.nativeCollectionEvidence.closingPublication.observedCards, 76)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
  assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const cap of ['maxJobs', 'maxPages']) test(cap + '=0 claims no native acquisition and makes no requests', async () => {
  let calls = 0
  const jobs = await collect({ [cap]: 0, fetchImpl: () => { calls++; throw Error('Unexpected native request') } })
  assert.equal(calls, 0)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('optional closing503 preserves known native criteria and original labelled posting date', async () => {
  const io = replay(record => record.phase === 'closing-role-25001' ? { ...record, status: 503, headers: { 'content-type': 'text/plain' }, bodyBase64: Buffer.from('temporarily unavailable').toString('base64') } : record)
  const jobs = await collect({ fetchImpl: io.fetchImpl })
  assert.equal(jobs.length, 75)
  const role = jobs.find(job => job.nativePublicJobId === '25001')
  assert.match(role.jobDescription, /Python and SQL/)
  assert.equal(role.postingDate, '2026-11-19T00:00:00.000Z')
  assert.equal(role.sourceClosingReconciled, true)
  assert.equal(role.sourceNativeRoleClosingQualified, false)
  assert.equal(role.sourceOptionalDetailFailure.httpStatus, 503)
})

test('complete200 optional native MIME contradiction holds the affected role', async () => {
  const io = replay(record => record.phase === 'closing-role-25001' ? { ...record, headers: { ...record.headers, 'content-type': 'text/css' } } : record)
  const jobs = await collect({ fetchImpl: io.fetchImpl })
  assert.equal(jobs.length, 74)
  assert.equal(jobs.some(job => job.nativePublicJobId === '25001'), false)
  assert.ok(jobs.nativeCollectionEvidence.held.some(row => row.nativePublicJobId === '25001'))
})

for (const status of [202, 401, 402, 403, 406, 407, 429, 451]) test('mandatory HTTP' + status + ' stops its origin after one request', async () => {
  const io = replay(record => ({ ...record, status }))
  await assert.rejects(collect({ fetchImpl: io.fetchImpl }), error => error.httpStatus === status && error.abortRetries === true)
  assert.equal(io.calls(), 1)
})

test('opaque cancellation at the actual final native response stays exact', async () => {
  const controller = new AbortController(), reason = Object.freeze({ kind: 'caller-stopped-current-native-run' })
  const io = replay((record, calls) => { if (calls === 174) controller.abort(reason); return record })
  await assert.rejects(collect({ fetchImpl: io.fetchImpl, signal: controller.signal }), error => error === reason)
  assert.equal(io.calls(), 174)
})
