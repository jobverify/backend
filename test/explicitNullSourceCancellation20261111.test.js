// Authored lifecycle controls. These supply no native inventory, vacancy,
// country, criteria or publication facts and perform no network or DB I/O.
import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter, getEventListeners } from 'node:events'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { run as disney } from '../scraper/disney.workday/script.js'
import { run as sunrun, createSunrunScraper } from '../scraper/sunrun/script.js'
import { run as att } from '../scraper/att.workday/script.js'
import { getAttNative } from '../scraper/att.workday/nativeHttp.js'

const reasons = [
  ['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen-error', () => Object.freeze(Error('authored frozen caller reason'))],
  ['mutable-network-error', () => Object.assign(Error('authored caller reason'), { code: 'ECONNRESET' })],
  ['default-dom-exception', () => AbortSignal.abort().reason],
]
const sources = [
  ['Disney', disney, { timeoutMs: 10000 }],
  ['Sunrun', sunrun, { timeoutMs: 10000 }],
  ['AT&T', att, { timeoutMs: 10000, sourceTimeoutMs: 20000 }],
]
const roleUrl = 'https://www.att.jobs/job/hyderabad/authored-lifecycle-boundary/117/123456789'
const now = '2026-11-11T06:00:00.000Z'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const snapshot = reason => reason !== null && (typeof reason === 'object' || typeof reason === 'function')
  ? Object.getOwnPropertyDescriptors(reason) : null
const timeouts = () => process.getActiveResourcesInfo().filter(type => type === 'Timeout').length
async function failureOf(pending) {
  let failed = false, reason
  try { await pending } catch (error) { failed = true; reason = error }
  assert.equal(failed, true, 'A cancelled source must reject')
  return reason
}
async function assertFinished(caller, reason, descriptors, timeoutCount) {
  await nextTurn()
  assert.equal(getEventListeners(caller.signal, 'abort').length, 0, 'Caller listener must be detached')
  assert.deepEqual(snapshot(reason), descriptors, 'Caller reason must remain unchanged')
  assert.ok(timeouts() <= timeoutCount, 'Owned timeout must be cleared')
}

for (const [label, run, limits] of sources) {
  for (const [kind, makeReason] of reasons) {
    test(`${label} preserves pre-aborted ${kind} without admitting transport`, { timeout: 3000 }, async () => {
      const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason)
      caller.abort(reason)
      let calls = 0
      const count = timeouts()
      const observed = await failureOf(run({ ...limits, now, signal: caller.signal,
        fetch: () => { calls++; throw Error('Unavailable pre-aborted transport') } }))
      assert.ok(Object.is(observed, reason))
      assert.equal(calls, 0)
      await assertFinished(caller, reason, descriptors, count)
    })

    for (const stage of ['transport', 'body', 'synchronous-return', 'synchronous-throw']) {
      test(`${label} retains ${kind} at ${stage} cancellation`, { timeout: 3000 }, async () => {
        const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason)
        const started = deferred(), late = deferred(), transportError = Object.freeze(TypeError('Authored transport failure'))
        let calls = 0, bodyCalls = 0
        const count = timeouts()
        const fetch = url => {
          calls++
          if (stage === 'transport') { started.resolve(); return late.promise }
          if (stage.startsWith('synchronous')) caller.abort(reason)
          if (stage === 'synchronous-throw') throw transportError
          return { status: 200, url, text: () => { bodyCalls++; started.resolve(); return late.promise } }
        }
        const pending = run({ ...limits, now, signal: caller.signal, fetch })
        if (!stage.startsWith('synchronous')) { await started.promise; caller.abort(reason) }
        const observed = await failureOf(pending)
        // Reject after terminal cancellation: strict process mode verifies the
        // abandoned producer remains owned without an unhandled rejection.
        if (stage === 'transport' || stage === 'body') late.reject(Object.freeze(Error('Authored late producer rejection')))
        assert.ok(Object.is(observed, reason))
        assert.equal(calls, 1)
        assert.equal(bodyCalls, stage === 'body' ? 1 : 0)
        await assertFinished(caller, reason, descriptors, count)
      })
    }
  }

  test(`${label} retains an uncancelled primary transport error`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), original = Object.freeze(TypeError('Authored ordinary transport failure'))
    const descriptors = snapshot(original), count = timeouts()
    assert.equal(await failureOf(run({ ...limits, now, signal: caller.signal, fetch: () => { throw original } })), original)
    await assertFinished(caller, original, descriptors, count)
  })
}

for (const [label, run, limits] of sources.filter(([name]) => name !== 'Disney')) {
  for (const [kind, makeReason] of reasons) {
    test(`${label} cancels queued transport admission for ${kind}`, { timeout: 3000 }, async () => {
      const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason)
      let calls = 0
      const count = timeouts()
      const pending = run({ ...limits, now, signal: caller.signal, fetch: () => { calls++; throw Error('Queued transport must remain unavailable') } })
      caller.abort(reason)
      assert.ok(Object.is(await failureOf(pending), reason))
      assert.equal(calls, 0, 'Cancellation before the producer microtask must stop transport admission')
      await assertFinished(caller, reason, descriptors, count)
    })
  }
}

for (const [kind, makeReason] of reasons) {
  test(`Sunrun factory defaults retain pre-aborted ${kind}`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason)
    caller.abort(reason)
    let calls = 0
    const count = timeouts()
    const factory = createSunrunScraper({ signal: caller.signal, timeoutMs: 10000,
      fetch: () => { calls++; throw Error('Unavailable pre-aborted factory transport') } })
    assert.ok(Object.is(await failureOf(factory.run({ now })), reason))
    assert.equal(calls, 0)
    await assertFinished(caller, reason, descriptors, count)
  })

  test(`AT&T native transport pre-aborted ${kind} never constructs a request`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason)
    caller.abort(reason)
    let calls = 0
    const count = timeouts()
    assert.ok(Object.is(await failureOf(getAttNative(roleUrl, { signal: caller.signal,
      requestImpl: () => { calls++; throw Error('Unavailable request constructor') } })), reason))
    assert.equal(calls, 0)
    await assertFinished(caller, reason, descriptors, count)
  })

  test(`AT&T native request signal and terminal error retain ${kind}`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason), started = deferred()
    let requestSignal, calls = 0, requestDestroyed = 0, responseDestroyed = 0
    const count = timeouts()
    const pending = getAttNative(roleUrl, { signal: caller.signal, requestImpl: (_url, options, incoming) => {
      calls++; requestSignal = options.signal
      const request = new EventEmitter(), response = new EventEmitter()
      request.destroy = () => { requestDestroyed++ }
      response.destroy = () => { responseDestroyed++ }
      response.statusCode = 200; response.headers = { 'content-type': 'text/html' }
      request.end = () => { incoming(response); started.resolve() }
      return request
    } })
    await started.promise
    caller.abort(reason)
    assert.ok(Object.is(await failureOf(pending), reason))
    assert.ok(Object.is(requestSignal.reason, reason), 'Forwarded request signal must retain caller reason')
    assert.equal(calls, 1)
    assert.equal(requestDestroyed, 1)
    assert.equal(responseDestroyed, 1)
    await assertFinished(caller, reason, descriptors, count)
  })
}

for (const [label, run, limits, message] of [
  ['Disney request', disney, { timeoutMs: 20 }, 'Disney native HTTP timeout'],
  ['Sunrun source', sunrun, { timeoutMs: 20 }, 'Sunrun inventory timed out'],
  ['AT&T request', att, { timeoutMs: 20, sourceTimeoutMs: 1000 }, 'AT&T native: Request timeout'],
  ['AT&T source', att, { timeoutMs: 1000, sourceTimeoutMs: 20 }, 'AT&T native: Source deadline exceeded'],
]) {
  test(`${label} retains its own deadline Error and clears listeners`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), count = timeouts()
    const observed = await failureOf(run({ ...limits, now, signal: caller.signal, fetch: () => new Promise(() => {}) }))
    assert.ok(observed instanceof Error)
    assert.equal(observed.message, message)
    assert.equal(caller.signal.aborted, false)
    await assertFinished(caller, observed, snapshot(observed), count)
  })

  test(`${label} stops a late response before admitting its body`, { timeout: 3000 }, async () => {
    const late = deferred(), caller = new AbortController(), count = timeouts()
    let requestedUrl, calls = 0, bodyCalls = 0
    const observed = await failureOf(run({ ...limits, now, signal: caller.signal,
      fetch: url => { calls++; requestedUrl = url; return late.promise } }))
    assert.equal(observed.message, message)
    late.resolve({ status: 200, url: requestedUrl, text: () => { bodyCalls++; return 'Unused authored lifecycle boundary' } })
    await nextTurn()
    assert.equal(calls, 1)
    assert.equal(bodyCalls, 0, 'A finished deadline must stop late body admission')
    await assertFinished(caller, observed, snapshot(observed), count)
  })
}
