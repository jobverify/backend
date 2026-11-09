import assert from 'node:assert/strict'
import test from 'node:test'
import { createDataikuPublicRead, HOME, LIMITS } from './publicRead.js'

for (const status of [200, 403]) for (const trigger of ['caller', 'source-budget']) {
  test(`${trigger} ends a stalled capture observer on HTTP ${status}`, { timeout: 2000 }, async () => {
    const controller = new AbortController(), callerReason = Object.freeze({ caller: 'Dataiku observer cancellation' })
    let entered, release, expire, calls = 0
    const observerEntered = new Promise(resolve => { entered = resolve })
    const observerHeld = new Promise(resolve => { release = resolve })
    const originalTimeout = globalThis.setTimeout
    let io
    try {
      globalThis.setTimeout = (callback, delay, ...rest) => {
        if (delay === LIMITS.sourceMs) expire = callback
        return originalTimeout(callback, delay, ...rest)
      }
      io = createDataikuPublicRead({ signal: controller.signal, fetchImpl: async url => {
        calls++
        const response = new Response('<title>Dataiku</title>', { status, headers: { 'Content-Type': 'text/html' } })
        Object.defineProperty(response, 'url', { value: url })
        return response
      }, onNativeResponse() { entered(); return observerHeld } })
    } finally { globalThis.setTimeout = originalTimeout }
    let outcome
    const pending = io.read(HOME).then(value => { outcome = { value } }, error => { outcome = { error } })
    try {
      await observerEntered
      if (trigger === 'caller') controller.abort(callerReason)
      else { assert.equal(typeof expire, 'function'); expire() }
      await new Promise(resolve => setImmediate(resolve))
      assert.ok(outcome, 'Cancellation must settle the read while its optional observer is still held')
      if (trigger === 'caller') assert.equal(outcome.error, callerReason)
      else if (status === 403) {
        assert.equal(outcome.error.failureKind, 'blocked_or_access_denied')
        assert.equal(outcome.error.status, 403)
      } else assert.equal(outcome.error, io.sourceSignal.reason)
      await io.settle()
      assert.equal(calls, 1)
      await assert.rejects(io.read(HOME))
      assert.equal(calls, 1)
    } finally { release(); await pending; await io.settle(); io.dispose() }
  })
}
