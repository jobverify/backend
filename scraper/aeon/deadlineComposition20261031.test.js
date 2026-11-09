import assert from 'node:assert/strict'
import test from 'node:test'

import { run as codevice } from '../codevicesolutionpvtltd/script.js'
import { run as lake } from '../lakechemicalspvtltd/script.js'
import { run as spire } from '../spiretechnologies/script.js'
import { run as technotreon } from '../technotreon/script.js'
import { run as srei } from '../srei/script.js'

for (const [name, run, expectedMs] of [
  ['codevice', codevice, 15000], ['lake', lake, 20000],
  ['spire', spire, 15000], ['technotreon', technotreon, 30000],
]) {
  test(`${name} retains its existing per-request timeout together with a live source caller`, async t => {
    const caller = new AbortController(), deadline = new AbortController()
    const reason = Object.freeze(new DOMException('controlled existing request deadline', 'TimeoutError'))
    const observed = []
    let bodies = 0, requestSignal, expire = () => deadline.abort(reason), cleared = false
    if (name === 'lake') {
      // Lake owns an explicit request timer alongside its longer source timer.
      const set = globalThis.setTimeout, clear = globalThis.clearTimeout, timer = {}
      t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
        if (ms !== expectedMs) return set(callback, ms, ...args)
        observed.push(ms); expire = callback; return timer
      })
      t.mock.method(globalThis, 'clearTimeout', value => {
        if (value === timer) { cleared = true; return }
        return clear(value)
      })
    } else t.mock.method(AbortSignal, 'timeout', ms => { observed.push(ms); return deadline.signal })
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requestSignal = options.signal
      assert.equal(requestSignal.aborted, false)
      expire()
      assert.equal(options.signal.aborted, true)
      if (name === 'lake') {
        const response = new Response(new ReadableStream({ pull(stream) {
          bodies++; stream.enqueue(new TextEncoder().encode('late invalid native body')); stream.close()
        } }, { highWaterMark: 0 }), { headers: { 'content-type': 'text/html' } })
        Object.defineProperty(response, 'url', { value: String(url) })
        return response
      }
      return { status: 200, url, text: async () => { bodies++; return 'late invalid native body' } }
    })
    await assert.rejects(run({ signal: caller.signal }), error => error === (name === 'lake' ? requestSignal.reason : reason))
    assert.deepEqual(observed, [expectedMs])
    if (name === 'lake') assert.equal(cleared, true)
    assert.equal(caller.signal.aborted, false)
    assert.equal(bodies, 0)
  })
}

for (const stage of ['headers', 'body']) {
  test(`Srei retains its existing 15000ms timer and checks an expired ${stage} result`, async t => {
    const caller = new AbortController()
    let expire, observedMs, requestSignal, bodies = 0, cleared = false
    const timer = { controlledDeadline: true }
    t.mock.method(globalThis, 'setTimeout', (callback, ms) => { expire = callback; observedMs = ms; return timer })
    t.mock.method(globalThis, 'clearTimeout', value => { assert.equal(value, timer); cleared = true })
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requestSignal = options.signal
      if (stage === 'headers') expire()
      return { status: 200, url, text: async () => { bodies++; expire(); return 'late invalid native body' } }
    })
    await assert.rejects(srei({ signal: caller.signal }), error => error === requestSignal.reason)
    assert.equal(observedMs, 15000)
    assert.equal(caller.signal.aborted, false)
    assert.equal(bodies, stage === 'body' ? 1 : 0)
    assert.equal(cleared, true)
  })
}
