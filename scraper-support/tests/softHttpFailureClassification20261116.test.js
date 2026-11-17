import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyScraperError } from '../utils/failureClassification.js'
import { runCurrentEvonikData, CAREERS } from '../../scraper/evonik.workday/currentNativeData20261114.js'

for (const [status, failureKind] of [[202, 'upstream_response_pending'], [403, 'blocked_or_access_denied'],
  [429, 'blocked_or_access_denied'], [503, 'network_or_timeout']]) {
  test('generic soft failures use structured HTTP ' + status + ' diagnostics', () => {
    const cause = Object.assign(new Error('Native response unavailable'), { status })
    const error = Object.assign(new Error('Native read stopped', { cause }), { softFailure: true })
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: true, failureKind })
  })
}

test('structured HTTP diagnostics do not override an explicit native source classification', () => {
  const error = Object.assign(new Error('Native source identity mismatch'), {
    softFailure: true, failureKind: 'incomplete_location_scope', upstreamOutage: false, status: 429,
  })
  assert.deepEqual(classifyScraperError(error), { softFailure: true, failureKind: 'incomplete_location_scope', upstreamOutage: false })
})

for (const status of [429, 503]) test('Evonik retains HTTP ' + status + ' classification and original denial evidence', async () => {
  let requests = 0
  await assert.rejects(runCurrentEvonikData({ fetchImpl: async url => {
    requests++
    assert.equal(url, CAREERS)
    return Object.defineProperty(new Response('Original public denial', { status, headers: { 'content-type': 'text/html' } }), 'url', { value: url })
  } }), error => {
    assert.equal(error.status, status)
    assert.equal(error.abortRetries, true)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(classifyScraperError(error).failureKind, status === 429 ? 'blocked_or_access_denied' : 'network_or_timeout')
    assert.equal(error.recruitmentObservations.receipts.length, 1)
    assert.equal(error.recruitmentObservations.receipts[0].status, status)
    assert.equal(error.recruitmentObservations.receipts[0].bodyComplete, true)
    return true
  })
  assert.equal(requests, 1)
})
