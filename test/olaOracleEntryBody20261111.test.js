import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { getEventListeners } from 'node:events'
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

// These are authored lifecycle protocols, never employer or vacancy captures.
let actualNetwork = 0
const deny = () => { actualNetwork++; throw Error('Entry/body test forbids real network') }
globalThis.fetch = deny
for (const module of [http, https]) { module.get = deny; module.request = deny }
http2.connect = deny; net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny; tls.connect = deny; dgram.createSocket = deny
syncBuiltinESMExports()
after(() => assert.equal(actualNetwork, 0))
const apis = [
  { label: 'Ola', run: runOla, ola: true }, { label: 'OlaElectric', run: runOlaElectric, ola: true },
  { label: 'ArcelorMittal', run: runArcelor }, { label: 'Landmark', run: runLandmark },
]
const reasons = [['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen', () => Object.freeze(Error('Authored caller reason'))], ['native', () => AbortSignal.abort().reason]]
const reflect = promise => Promise.resolve(promise).then(value => ({ fulfilled: true, value }), error => ({ fulfilled: false, error }))
const turn = () => new Promise(resolve => setImmediate(resolve))
const exact = (result, reason) => { assert.equal(result.fulfilled, false); assert.ok(Object.is(result.error, reason)) }
const stamp = '2026-11-11T00:00:00.000Z'

for (const api of apis) for (const mode of ['pre-return', 'pre-throw', 'active-return', 'active-throw', 'coercion-throw', 'coercion-invalid']) {
  for (const [kind, makeReason] of reasons) test(`${api.label} clock ${mode} preserves ${kind}`, async () => {
    const caller = new AbortController(), reason = makeReason()
    const ordinary = Error('Authored ordinary clock error')
    let clocks = 0, transports = 0
    if (mode.startsWith('pre-')) caller.abort(reason)
    const now = () => {
      clocks++
      if (mode === 'active-return' || mode === 'active-throw') caller.abort(reason)
      if (mode.endsWith('throw') && !mode.startsWith('coercion')) throw ordinary
      if (mode.startsWith('coercion')) return { [Symbol.toPrimitive]() {
        caller.abort(reason)
        if (mode === 'coercion-throw') throw ordinary
        return 'invalid authored timestamp'
      } }
      return stamp
    }
    const fetchControl = () => { transports++; throw Error('Cancelled clock admitted transport') }
    const observed = await reflect(api.run({ signal: caller.signal, now,
      fetchPage: fetchControl, fetchImpl: fetchControl, requestIntervalMs: 0, timeoutMs: 2000 }))
    exact(observed, reason)
    assert.equal(clocks, mode.startsWith('pre-') ? 0 : 1)
    assert.equal(transports, 0)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  })
}

for (const api of apis) for (const [kind, makeReason] of reasons) test(`${api.label} late raw response after ${kind} admits no metadata or body`, async () => {
  const caller = new AbortController(), reason = makeReason(), release = Promise.withResolvers()
  let requests = 0, bodies = 0
  const reads = []
  globalThis.fetch = () => { requests++; return release.promise }
  try {
    const pending = reflect(api.run({ signal: caller.signal, now: stamp, requestIntervalMs: 1000, timeoutMs: 2000 }))
    await turn(); assert.equal(requests, 1)
    caller.abort(reason)
    exact(await pending, reason)
    const response = {}
    for (const key of ['status', 'url', 'text']) Object.defineProperty(response, key, { get() {
      reads.push(key)
      return key === 'status' ? 200 : key === 'url' ? 'https://authored.invalid/' : () => { bodies++; return Promise.reject(Error('Late authored body rejection')) }
    } })
    release.resolve(response)
    await turn(); await turn()
    assert.deepEqual(reads, []); assert.equal(bodies, 0)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  } finally { globalThis.fetch = deny }
})

for (const api of apis.filter(api => !api.ola)) for (const key of ['status', 'url', 'text']) {
  for (const [kind, makeReason] of reasons) test(`${api.label} raw ${key} getter cancelling ${kind} stops later reads/body`, async () => {
    const caller = new AbortController(), reason = makeReason(), reads = []
    let bodies = 0, requests = 0
    globalThis.fetch = async url => {
      requests++
      const response = {}
      for (const name of ['status', 'url', 'text']) Object.defineProperty(response, name, { get() {
        assert.equal(this, response); reads.push(name)
        if (name === key) caller.abort(reason)
        return name === 'status' ? 200 : name === 'url' ? url : function () { bodies++; return Promise.resolve('Authored unread body') }
      } })
      return response
    }
    try {
      exact(await reflect(api.run({ signal: caller.signal, now: stamp, timeoutMs: 2000 })), reason)
      assert.deepEqual(reads, ['status', 'url', 'text'].slice(0, ['status', 'url', 'text'].indexOf(key)+1))
      assert.equal(bodies, 0); assert.equal(requests, 1)
      assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
    } finally { globalThis.fetch = deny }
  })
}

for (const api of apis) {
  for (const [kind, value] of [['string', stamp], ['number', +new Date(stamp)], ['date', new Date(stamp)], ['function', () => stamp], ['null', null], ['undefined', undefined]]) {
    test(`${api.label} ordinary ${kind} clock still reaches the original transport`, async () => {
      const ordinary = Error('Authored ordinary first transport')
      let calls = 0
      const fetchControl = () => { calls++; throw ordinary }
      const observed = await reflect(api.run({ now: value, fetchPage: fetchControl, fetchImpl: fetchControl,
        requestIntervalMs: 0, timeoutMs: 2000 }))
      assert.equal(observed.fulfilled, false); assert.equal(observed.error, ordinary); assert.equal(calls, 1)
    })
  }
  test(`${api.label} ordinary clock throw retains its exact primary`, async () => {
    const ordinary = Object.freeze(Error('Authored frozen clock failure'))
    const observed = await reflect(api.run({ now() { throw ordinary }, requestIntervalMs: 0, timeoutMs: 2000 }))
    assert.equal(observed.fulfilled, false); assert.equal(observed.error, ordinary)
  })
  test(`${api.label} ordinary clock keeps receiver and call count`, async () => {
    let clocks = 0, requests = 0
    const fetchControl = () => { requests++; throw Error('Authored ordinary transport') }
    const observed = await reflect(api.run({ now() {
      clocks++; assert.equal(this.fetchPage, fetchControl); return stamp
    }, fetchPage: fetchControl, fetchImpl: fetchControl, requestIntervalMs: 0, timeoutMs: 2000 }))
    assert.equal(observed.fulfilled, false); assert.equal(clocks, 1); assert.equal(requests, 1)
  })
}
