import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { runNativeKeka } from '../scraper/acciojob/nativeKeka.js'
import accio from '../scraper/acciojob/nativeConfig.js'
import open from '../scraper/openfinancialtechnologies/nativeConfig.js'

// Authored clock/coercion and property-setter controls; no employer responses.
const reasons = [
  ['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen', () => Object.freeze(Error('Authored opaque caller'))], ['default', () => AbortSignal.abort().reason],
]
const flags = { abortRetries: true, softFailure: true, upstreamOutage: true, failureKind: 'network_or_timeout' }
const descriptor = value => value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const outcome = promise => promise.then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason, reason)) }
const base = { requestIntervalMs: 0, timeoutMs: 1000 }
const turn = () => new Promise(resolve => setImmediate(resolve))
const activeTimers = () => process.getActiveResourcesInfo().filter(kind => kind === 'Timeout').length

for (const config of [accio, open]) {
  for (const [kind, make] of reasons) for (const form of ['value', 'function']) for (const disposition of ['valid', 'invalid', 'throw']) {
    test(`${config.source} ${form} clock coercion abort ${kind} then ${disposition} remains exact`, async () => {
      const caller = new AbortController(), reason = make(), before = descriptor(reason), timers = activeTimers()
      const replacement = Object.freeze(Error('Authored coercion replacement'))
      let coercions = 0, fetches = 0
      const clock = { [Symbol.toPrimitive]() {
        coercions++; caller.abort(reason)
        if (disposition === 'throw') throw replacement
        return disposition === 'valid' ? '2026-11-11T00:00:00.000Z' : 'invalid clock'
      } }
      exact(await outcome(runNativeKeka(config, { ...base, signal: caller.signal, now: form === 'value' ? clock : () => clock,
        fetchImpl() { fetches++; throw Error('No transport after cancellation') } })), reason)
      await turn()
      assert.equal(coercions, 1); assert.equal(fetches, 0)
      assert.deepEqual(descriptor(reason), before)
      assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
      assert.equal(activeTimers(), timers)
    })
  }

  for (const key of Object.keys(flags)) test(`${config.source} ${key} setter cancellation stops later diagnostic writes`, async () => {
    const caller = new AbortController(), primary = Error('ECONNRESET authored classifier input'), timers = activeTimers()
    let whenAborted, setters = 0, fetches = 0
    Object.defineProperty(primary, key, { configurable: true, set() {
      setters++; whenAborted = descriptor(primary); caller.abort(primary)
    } })
    exact(await outcome(runNativeKeka(config, { ...base, signal: caller.signal, now: '2026-11-11T00:00:00.000Z',
      fetchImpl() { fetches++; throw primary } })), primary)
    await turn()
    assert.equal(setters, 1); assert.equal(fetches, 1)
    assert.deepEqual(descriptor(primary), whenAborted, 'No diagnostic property may be written after it becomes the caller reason')
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
    assert.equal(activeTimers(), timers)
  })

  for (const key of Object.keys(flags)) test(`${config.source} ordinary ${key} setter retains assignment order and thrown identity`, async () => {
    const primary = Error('ECONNRESET authored classifier input'), replacement = Object.freeze(Error('Authored setter failure'))
    let setters = 0
    Object.defineProperty(primary, key, { configurable: true, set() { setters++; throw replacement } })
    exact(await outcome(runNativeKeka(config, { ...base, now: '2026-11-11T00:00:00.000Z', fetchImpl() { throw primary } })), replacement)
    assert.equal(setters, 1)
    const keys = Object.keys(flags), index = keys.indexOf(key)
    for (const [position, name] of keys.entries()) {
      if (position < index) assert.equal(primary[name], flags[name])
      else if (position > index) assert.equal(Object.hasOwn(primary, name), false)
    }
  })

  for (const kind of ['string', 'date', 'number', 'coercible']) test(`${config.source} normal ${kind} clock retains validation and receiver behavior`, async () => {
    const primary = Object.freeze(Error('Authored ordinary transport primary'))
    let conversions = 0, fetches = 0
    const clock = kind === 'string' ? '2026-11-11T00:00:00.000Z' : kind === 'date' ? new Date('2026-11-11T00:00:00.000Z')
      : kind === 'number' ? 0 : { [Symbol.toPrimitive]() { conversions++; assert.equal(this, clock); return '2026-11-11T00:00:00.000Z' } }
    exact(await outcome(runNativeKeka(config, { ...base, now: clock, fetchImpl() { fetches++; throw primary } })), primary)
    assert.equal(fetches, 1); assert.equal(conversions, kind === 'coercible' ? 1 : 0)
  })
}
