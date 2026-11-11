// Authored lifecycle/protocol boundaries for the retained legacy export.
// Current registered Acciojob/Open Financial readers are separate. No live
// HTTP, native vacancies, inventory, country or criteria facts are supplied.
import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { runNativeKeka } from '../scraper/acciojob/nativeKeka.js'
import accio from '../scraper/acciojob/nativeConfig.js'
import open from '../scraper/openfinancialtechnologies/nativeConfig.js'

const configs = [accio, open]
const reasons = [
  ['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen-error', () => Object.freeze(Error('authored caller reason'))],
  ['default-dom-exception', () => AbortSignal.abort().reason],
  ['mutable-network-error', () => Error('ECONNRESET authored caller cancellation')],
  ['frozen-network-error', () => Object.freeze(Error('ECONNRESET authored caller cancellation'))],
]
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const snapshot = value => value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const timeouts = () => process.getActiveResourcesInfo().filter(kind => kind === 'Timeout').length
async function failureOf(pending) {
  let failed = false, reason
  try { await pending } catch (error) { failed = true; reason = error }
  assert.equal(failed, true, 'Unavailable/cancelled legacy collection must reject')
  return reason
}
async function finished(caller, reason, descriptors, count) {
  await nextTurn()
  assert.deepEqual(snapshot(reason), descriptors, 'Caller/primary reason must remain unchanged')
  assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  assert.ok(timeouts() <= count, 'Source and pacing timers must be cleared')
}
const base = { now: '2026-11-11T06:00:00.000Z', requestIntervalMs: 0, timeoutMs: 10000 }

for (const config of configs) {
  for (const [kind, makeReason] of reasons) {
    for (const stage of ['pre-abort', 'queued', 'transport', 'body', 'pacing', 'synchronous-throw']) {
      test(`${config.source} legacy ${stage} retains unchanged ${kind}`, { timeout: 3000 }, async () => {
        const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason)
        const started = deferred(), late = deferred(), count = timeouts()
        let calls = 0
        const fetchImpl = url => {
          calls++
          if (stage === 'synchronous-throw') { caller.abort(reason); throw Object.freeze(TypeError('Authored secondary failure')) }
          if (stage === 'transport') { started.resolve(); return late.promise }
          if (stage === 'body') return { status: 200, url, headers: { get: () => 'text/html' },
            text: () => { started.resolve(); return late.promise } }
          if (stage === 'pacing') {
            assert.ok(url === config.officialUrl || url === config.shellUrl, 'Only two authored declaration boundaries may be read')
            return { status: 200, url, headers: { get: () => 'text/html' }, text: () => {
              if (url === config.officialUrl) return `<a href="${config.shellUrl}">Careers</a>`
              setImmediate(() => caller.abort(reason))
              return `<script>fetch("${new URL(config.documentUrl).pathname}")</script>`
            } }
          }
          throw TypeError('Unavailable queued/pre-aborted transport')
        }
        if (stage === 'pre-abort') caller.abort(reason)
        const pending = runNativeKeka(config, { ...base, requestIntervalMs: stage === 'pacing' ? 1000 : 0,
          signal: caller.signal, fetchImpl })
        if (stage === 'queued') caller.abort(reason)
        if (stage === 'transport' || stage === 'body') { await started.promise; caller.abort(reason) }
        const observed = await failureOf(pending)
        if (stage === 'transport' || stage === 'body') late.reject(Object.freeze(Error('Authored late producer rejection')))
        assert.ok(Object.is(observed, reason), 'Terminal reason must be the caller reason')
        assert.equal(calls, ['pre-abort', 'queued'].includes(stage) ? 0 : stage === 'pacing' ? 2 : 1)
        await finished(caller, reason, descriptors, count)
      })
    }
  }

  for (const [kind, makeReason] of [
    ['undefined', () => undefined], ['null', () => null], ['false', () => false],
    ['zero', () => 0], ['empty', () => ''],
    ['frozen-ordinary', () => Object.freeze(TypeError('Authored ordinary primary'))],
    ['frozen-network', () => Object.freeze(Error('ECONNRESET authored immutable primary'))],
  ]) {
    test(`${config.source} legacy preserves uncancelled ${kind} primary failure`, { timeout: 3000 }, async () => {
      const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason), count = timeouts()
      assert.ok(Object.is(await failureOf(runNativeKeka(config, { ...base, signal: caller.signal,
        fetchImpl: () => { throw reason } })), reason))
      await finished(caller, reason, descriptors, count)
    })
  }

  test(`${config.source} legacy retains ordinary mutable network classification`, { timeout: 3000 }, async () => {
    const primary = Error('ECONNRESET authored request failure'), caller = new AbortController(), count = timeouts()
    assert.equal(await failureOf(runNativeKeka(config, { ...base, signal: caller.signal, fetchImpl: () => { throw primary } })), primary)
    assert.equal(primary.abortRetries, true)
    assert.equal(primary.softFailure, true)
    assert.equal(primary.upstreamOutage, true)
    assert.equal(primary.failureKind, 'network_or_timeout')
    await finished(caller, primary, snapshot(primary), count)
  })

  for (const status of [401, 403, 429, 500]) {
    test(`${config.source} legacy retains HTTP ${status} stop and classification`, { timeout: 3000 }, async () => {
      let calls = 0
      const caller = new AbortController(), count = timeouts()
      const primary = await failureOf(runNativeKeka(config, { ...base, signal: caller.signal,
        fetchImpl: () => { calls++; return { status } } }))
      assert.equal(calls, 1)
      assert.equal(primary.status, status)
      assert.equal(primary.abortRetries, true)
      assert.equal(primary.softFailure, true)
      assert.equal(primary.upstreamOutage, true)
      assert.equal(primary.failureKind, status === 500 ? 'network_or_timeout' : 'public_access_denied')
      await finished(caller, primary, snapshot(primary), count)
    })
  }

  test(`${config.source} legacy source deadline keeps its original Error classification`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), count = timeouts()
    const primary = await failureOf(runNativeKeka(config, { ...base, timeoutMs: 20, signal: caller.signal,
      fetchImpl: () => new Promise(() => {}) }))
    assert.equal(primary.message, 'Keka bounded source deadline exceeded')
    assert.equal(primary.abortRetries, true)
    assert.equal(primary.softFailure, true)
    assert.equal(primary.failureKind, 'network_or_timeout')
    await finished(caller, primary, snapshot(primary), count)
  })
}
