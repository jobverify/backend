import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dgram from 'node:dgram'
import { run as runOla } from '../scraper/ola/script.js'
import { run as runOlaElectric } from '../scraper/olaelectric/script.js'
import { run as runArcelor } from '../scraper/arcelormittal/script.js'
import { run as runLandmark } from '../scraper/landmarkgroup/script.js'

// Authored lifecycle protocols only. No employer response or vacancy fixture.
let networkAttempts = 0
const deny = () => { networkAttempts++; throw Error('Lifecycle test forbids real network') }
globalThis.fetch = deny
for (const module of [http, https]) { module.get = deny; module.request = deny }
http2.connect = deny; net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny; tls.connect = deny; dgram.createSocket = deny
syncBuiltinESMExports()
after(() => assert.equal(networkAttempts, 0))
const apis = [
  { label: 'Ola', run: runOla, ola: true },
  { label: 'Ola Electric', run: runOlaElectric, ola: true },
  { label: 'ArcelorMittal', run: runArcelor },
  { label: 'Landmark', run: runLandmark },
]
const reasons = [
  ['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen', () => Object.freeze(Error('Authored caller reason'))],
  ['native', () => AbortSignal.abort().reason],
]
const outcome = promise => Promise.resolve(promise).then(value => ({ fulfilled: true, value }), error => ({ fulfilled: false, error }))
const invoke = (api, fetchControl, signal) => api.run({ signal, fetchPage: fetchControl, fetchImpl: fetchControl,
  requestIntervalMs: 0, timeoutMs: 2000 })

for (const api of apis) {
  for (const mode of ['preabort', 'active-stalled', 'active-throw', 'active-return']) {
    for (const [kind, makeReason] of reasons) test(`${api.label} preserves ${kind} through ${mode}`, async () => {
      const caller = new AbortController(), reason = makeReason(), release = Promise.withResolvers()
      const ordinary = Error('Authored unrelated collaborator error')
      let calls = 0, timer
      const fetchControl = () => {
        calls++; caller.abort(reason)
        if (mode === 'active-stalled') return release.promise
        if (mode === 'active-throw' || mode === 'preabort') throw ordinary
        return null
      }
      if (mode === 'preabort') caller.abort(reason)
      const terminal = outcome(invoke(api, fetchControl, caller.signal))
      let observed = await Promise.race([terminal, new Promise(resolve => { timer = setTimeout(() => resolve({ stalled: true }), 200) })])
      clearTimeout(timer)
      const settledBeforeRelease = !observed.stalled
      if (mode === 'active-stalled') {
        release.reject(ordinary)
        if (observed.stalled) observed = await terminal
      }
      assert.equal(calls, mode === 'preabort' ? 0 : 1)
      assert.equal(settledBeforeRelease, true, 'Caller cancellation must settle a noncooperative collaborator')
      assert.equal(observed.fulfilled, false)
      assert.ok(Object.is(observed.error, reason), 'The exact caller reason must survive')
    })
  }
  for (const [name, makeError] of [
    ['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
    ['ordinary', () => Error('Authored ordinary collaborator failure')],
    ['frozen network error', () => Object.freeze(Error('fetch failed'))],
    ['sealed network error', () => Object.seal(Error('socket disconnected'))],
    ['throwing diagnostic getter', () => Object.defineProperty({}, 'message', { get() { throw Error('Secondary diagnostic failure') } })],
  ]) test(`${api.label} retains primary ${name}`, async () => {
    const primary = makeError()
    let calls = 0
    const observed = await outcome(invoke(api, () => { calls++; throw primary }))
    assert.equal(calls, 1)
    assert.equal(observed.fulfilled, false)
    assert.ok(Object.is(observed.error, primary), 'Optional error diagnostics must not replace the primary failure')
  })
  for (const status of [401, 403, 429, 451]) test(`${api.label} keeps denial ${status} terminal`, async () => {
    let calls = 0
    const observed = await outcome(invoke(api, url => { calls++; return { status, url, body: 'Authored denial', headers: { get: () => 'text/html' } } }))
    assert.equal(observed.fulfilled, false)
    assert.match(observed.error.message, new RegExp(`HTTP ${status}`))
    assert.equal(calls, 1)
  })
  if (!api.ola) continue
  for (const [kind, makeReason] of reasons) test(`${api.label} stops queued producer for ${kind}`, async () => {
    const caller = new AbortController(), reason = makeReason()
    let calls = 0
    const pending = outcome(invoke(api, () => { calls++; throw Error('Cancelled queued producer was admitted') }, caller.signal))
    caller.abort(reason)
    const observed = await pending
    assert.equal(observed.fulfilled, false)
    assert.ok(Object.is(observed.error, reason))
    assert.equal(calls, 0)
  })
  for (const trigger of ['message-getter', 'message-coercion', 'throwing-message', 'diagnostic-setter']) {
    for (const [kind, makeReason] of reasons) test(`${api.label} stops diagnostic writes after ${trigger} cancels ${kind}`, async () => {
      const caller = new AbortController(), reason = makeReason(), writes = []
      const primary = {}
      Object.defineProperty(primary, 'message', { get() {
        if (trigger === 'message-getter') caller.abort(reason)
        if (trigger === 'throwing-message') { caller.abort(reason); throw Error('Secondary diagnostic getter') }
        if (trigger === 'message-coercion') return { [Symbol.toPrimitive]() { caller.abort(reason); return 'fetch failed' } }
        return 'fetch failed'
      } })
      for (const key of ['softFailure', 'upstreamOutage', 'abortRetries', 'failureKind']) Object.defineProperty(primary, key, {
        set(value) { writes.push([key, value]); if (trigger === 'diagnostic-setter') caller.abort(reason) },
      })
      const observed = await outcome(invoke(api, () => { throw primary }, caller.signal))
      assert.equal(observed.fulfilled, false)
      assert.ok(Object.is(observed.error, reason))
      assert.deepEqual(writes.map(([key]) => key), trigger === 'diagnostic-setter' ? ['softFailure'] : [])
    })
  }
  test(`${api.label} retains ordinary writable network diagnostics`, async () => {
    const primary = Error('fetch failed')
    const observed = await outcome(invoke(api, () => { throw primary }))
    assert.equal(observed.error, primary)
    assert.equal(primary.softFailure, true); assert.equal(primary.upstreamOutage, true)
    assert.equal(primary.abortRetries, true); assert.equal(primary.failureKind, 'network_or_timeout')
  })
}
