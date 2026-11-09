import test from 'node:test'
import assert from 'node:assert/strict'
import * as native from './native.js'
import { fixture, now } from './test-data/fixture.mjs'
const capture = { ...fixture.capture, requests: fixture.packets }, bodies = fixture.packets.map(packet => packet.body)
const captureRejection = async action => { try { await action() } catch (error) { return { error } } assert.fail('Expected rejection') }
function mockDefault(t, { reason, bodyFailure = false, controller, callerReason, pending = false } = {}) {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(url); assert.equal(init.redirect, 'manual'); assert.ok([native.HOMEPAGE_URL, native.CAREERS_URL].includes(url))
    if (url === native.CAREERS_URL) {
      if (controller) { controller.abort(callerReason); return new Promise(() => {}) }
      if (pending) return new Promise(() => {})
      if (reason !== undefined && !bodyFailure) throw reason
      if (bodyFailure) return { status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), body: { getReader: () => ({ read: () => Promise.reject(reason), cancel: async () => {} }) } }
    }
    const response = new Response(url === native.HOMEPAGE_URL ? bodies[0] : bodies[1], { status: 200, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url }); return response
  })
  return calls
}
const progress = error => {
  assert.equal(error.code, 'native_unavailable'); assert.equal(error.abortRetries, undefined)
  assert.equal(error.inventoryEvidence?.pagesFetched, 1); assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.firstParty, true); assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null); assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  const packet = error.nativePrimaryReceipts.packets[0]
  assert.equal(error.nativePrimaryReceipts.packets.length, 1); assert.equal(packet.sha256, capture.requests[0].sha256)
  assert.equal(packet.httpInterface, 'default-http-interface'); assert.equal(packet.clockInjected, true)
  assert.equal(error.nativePrimaryReceipts.currentRoleAvailabilityProven, false); assert.equal(error.nativePrimaryReceipts.companyScopeComplete, false)
}
for (const bodyFailure of [false, true]) test('default native ' + (bodyFailure ? 'body' : 'header') + ' rejection retains homepage packet and original frozen cause', async t => {
  const reason = Object.freeze(new TypeError(bodyFailure ? 'native stream rejected' : 'native fetch rejected')), before = Object.getOwnPropertyDescriptors(reason)
  const calls = mockDefault(t, { reason, bodyFailure })
  const { error } = await captureRejection(() => native.collect({ now }))
  assert.notEqual(error, reason); progress(error); assert.equal(error.cause.cause, reason)
  assert.deepEqual(Object.getOwnPropertyDescriptors(reason), before); assert.equal(calls.length, 2)
})
test('default unowned hostile reason is wrapped without inspecting getters', async t => {
  let reads = 0; const reason = new Proxy(Object.freeze({ opaque: true }), { get() { reads++; throw Error('must not inspect') } })
  mockDefault(t, { reason })
  const { error } = await captureRejection(() => native.collect({ now }))
  assert.notEqual(error, reason); progress(error); assert.equal(error.cause.cause, reason); assert.equal(reads, 0)
})
for (const clockInjected of [false, true]) test('healthy default path preserves3 raw roles and correct clock tag: ' + clockInjected, async t => {
  const calls = mockDefault(t), jobs = await native.collect(clockInjected ? { now } : {})
  assert.equal(jobs.length, 3); assert.equal(calls.length, 2)
  for (const row of jobs) {
    for (const key of ['jobDescription', 'sourceDescription', 'country', 'location', 'nativeLegalEmployer', 'jobId', 'postingDate']) assert.equal(row[key], null)
    assert.equal(row.sourceDetailComplete, false); assert.equal(row.sourceScopeComplete, false)
    for (const packet of row.nativeRoleObservation.primaryPacketReferences) { assert.equal(packet.httpInterface, 'default-http-interface'); assert.equal(packet.clockInjected, clockInjected) }
  }
})
for (const hostile of [false, true]) test('explicit injected unowned rejection retains exact identity: ' + hostile, async () => {
  let reads = 0
  const reason = hostile ? new Proxy(Object.freeze({ opaque: true }), { get() { reads++; throw Error('must not inspect') } }) : Object.freeze(new TypeError('explicitly injected'))
  const { error } = await captureRejection(() => native.collect({ now, fetchImpl: async url => {
    if (url === native.CAREERS_URL) throw reason
    assert.equal(url, native.HOMEPAGE_URL)
    const response = new Response(bodies[0], { status: 200, headers: { 'content-type': 'text/html' } }); Object.defineProperty(response, 'url', { value: url }); return response
  } }))
  assert.equal(error, reason); assert.equal(reads, 0)
})
const reasons = [
  ['frozen-object', Object.freeze({ shared: true })], ['frozen-error', Object.freeze(Error('opaque caller'))], ['null', null], ['zero', 0], ['false', false], ['empty-string', ''], ['symbol', Symbol('opaque')], ['undefined-default', undefined],
]
let callerGetterReads = 0
reasons.push(['hostile-proxy', new Proxy(Object.freeze({ shared: true }), { get() { callerGetterReads++; throw Error('must not inspect caller') } })])
for (const [name, reason] of reasons) {
  test('default caller preabort retains exact reason: ' + name, async t => {
    const controller = new AbortController(); controller.abort(reason); const expected = controller.signal.reason
    let calls = 0; t.mock.method(globalThis, 'fetch', () => { calls++; throw Error('must not fetch') })
    const { error } = await captureRejection(() => native.collect({ signal: controller.signal }))
    assert.equal(error, expected); assert.equal(calls, 0); assert.equal(callerGetterReads, 0)
  })
  test('default caller abort after homepage retains exact reason: ' + name, async t => {
    const controller = new AbortController(), calls = mockDefault(t, { controller, callerReason: reason })
    const { error } = await captureRejection(() => native.collect({ signal: controller.signal, now }))
    assert.equal(error, controller.signal.reason); assert.equal(calls.length, 2); assert.equal(callerGetterReads, 0)
  })
}
test('owned default timeout keeps original classification and cause', async t => {
  mockDefault(t, { pending: true })
  const { error } = await captureRejection(() => native.collect({ now, requestTimeoutMs: 5 }))
  assert.equal(error.code, 'native_request_timed_out'); assert.equal(error.abortRetries, true)
  assert.equal(error.cause.code, error.code); assert.equal(error.inventoryEvidence.pagesFetched, 1)
  assert.equal(error.nativePrimaryReceipts.packets[0].httpInterface, 'default-http-interface')
})
