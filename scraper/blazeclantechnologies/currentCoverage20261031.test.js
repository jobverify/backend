import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, CAREERS_URL, hasOfficialCareersSignal, isBrokenZohoBoardPage } from './script.js'
import { registerCurrentRecruitmentContract } from '../../scraper-support/tests/helpers/currentRecruitmentContract.js'

const input = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-unavailable-20261031.json.gz', import.meta.url))))
const capturedTls = input.corporate.find(packet => packet.url === CAREERS_URL)
const tlsError = () => Object.assign(new TypeError(capturedTls.error), { cause: { code: capturedTls.code, message: capturedTls.cause } })

test('the current real TLS failure cannot establish a freshly verified first-party hiring surface', async () => {
  let calls = 0
  await assert.rejects(run({ maxPages: 1, now: () => '2026-10-31T07:19:33.000Z', fetchPage: async url => { calls++; assert.equal(url, CAREERS_URL); throw tlsError() } }), error => {
    const evidence = error.recruitmentObservations
    assert.equal(error.failureKind, 'network_or_timeout')
    assert.equal(error.softFailure, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.code, capturedTls.code)
    assert.equal(error.cause.cause.code, capturedTls.code)
    assert.equal(evidence.nativeRecords, 0)
    assert.equal(evidence.receipts.length, 0)
    assert.equal(evidence.sourceScopeComplete, false)
    assert.equal(evidence.lifecycleCleanupAllowed, false)
    assert.equal(evidence.observedAt, '2026-10-31T07:19:33.000Z')
    assert.ok(evidence.failures.some(row => row.message === capturedTls.error))
    return true
  })
  assert.equal(calls, 1)
})

test('Blazeclan cancellation before inspection makes no request', async () => {
  const controller = new AbortController(), reason = Error('stop Blazeclan')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { calls++; throw tlsError() } }), error => error === reason)
  assert.equal(calls, 0)
})

test('the supplied inspection clock reaches the unavailable-source evidence', async () => {
  await assert.rejects(run({ now: () => '2026-10-31T07:19:33.000Z', fetchPage: async () => { throw tlsError() } }), error => {
    assert.equal(error.recruitmentObservations.observedAt, '2026-10-31T07:19:33.000Z')
    return true
  })
})

test('Blazeclan forwards the active caller signal and retains its reason on transport cancellation', async () => {
  const controller = new AbortController(), reason = Error('stop started Blazeclan')
  await assert.rejects(run({ signal: controller.signal, fetchPage: async (url, options) => {
    assert.equal(options.signal.aborted, false)
    controller.abort(reason)
    assert.equal(options.signal.reason, reason)
    throw new DOMException('aborted transport', 'AbortError')
  } }), error => error === reason)
})

registerCurrentRecruitmentContract('blazeclantechnologies', 'captured boundary and current extraction')

test('the historical advertised Zoho tenant is still unavailable, without native identity carriers', () => {
  assert.equal(isBrokenZohoBoardPage(input.historicalBoard.body), true)
  assert.equal(/id="(?:meta|jobs)"/.test(input.historicalBoard.body), false)
  assert.equal(JSON.parse(input.publicWordPressPage.body)[0].content.rendered, '')
})

test('inert or hidden historical CTA text cannot establish an active first-party handoff', () => {
  const phrase = 'Join us to grow your career by doing what you love to do and treading the path where you want to go.'
  const anchor = '<a href="https://blazeclan.zohorecruit.in/jobs/Careers" class="cta-btn">Current Openings</a>'
  assert.equal(hasOfficialCareersSignal(phrase + '<!-- ' + anchor + ' -->'), false)
  assert.equal(hasOfficialCareersSignal(phrase + '<div hidden>' + anchor + '</div>'), false)
  assert.equal(hasOfficialCareersSignal(phrase + '<style>.cta-btn{display:none}</style>' + anchor), false)
})
