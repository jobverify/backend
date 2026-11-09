import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, OFFICIAL_CAREERS_URL } from './script.js'

const load = name => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/phase3-20261024/' + name + '.json.gz', import.meta.url))))
const home = load('probe-0')
const board = load('probe-1')
test('current AgNext Forbidden redirect retains final transport evidence and never reports inventory', async () => {
  const fetchImpl = async url => {
    const capture = new URL(url).hostname.replace(/^www\./, '') === 'agnext.com' ? home : board
    const response = new Response(capture.body, { status: capture.status, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: capture.finalUrl })
    return response
  }
  await assert.rejects(run({ fetchImpl }), error => {
    const denial = error.recruitmentObservations.receipts.find(row => row.finalURL === 'https://agnext.keka.com/careers/Content/403.html')
    assert.equal(denial.status, 200)
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.abortRetries, true)
    return true
  })
})

test('AgNext retains the blocked HTTP source stage before a response body is accepted', async () => {
  const fetchImpl = async url => {
    const response = new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  await assert.rejects(run({ fetchImpl }), error => {
    const receipt = error.recruitmentObservations.receipts.find(row => row.requestedURL === OFFICIAL_CAREERS_URL)
    assert.equal(receipt.status, 403)
    assert.equal(receipt.finalURL, OFFICIAL_CAREERS_URL)
    assert.ok(error.recruitmentObservations.failures.some(row => /HTTP 403/.test(row.message)))
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.status, 403)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
    assert.equal(error.abortRetries, true)
    return true
  })
})
