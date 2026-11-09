import assert from 'node:assert/strict'
import test from 'node:test'
import { run as komprise } from '../../scraper/komprise/script.js'
import { run as linkedin } from '../../scraper/linkedin/script.js'
import { run as loyalwingmantechnologies } from '../../scraper/loyalwingmantechnologies/script.js'
import { run as mudrex } from '../../scraper/mudrex/script.js'

for (const [name, run] of Object.entries({ komprise, linkedin, loyalwingmantechnologies, mudrex })) {
  test(`${name} checks cancellation before any native request`, async () => {
    const reason = Object.freeze(Error('caller cancelled ' + name))
    await assert.rejects(run({ signal: AbortSignal.abort(reason),
      fetchText: async () => assert.fail('cancelled source must not fetch') }), error => error === reason)
  })

  test(`${name} forwards caller cancellation and checks it after an uncooperative injected read`, async () => {
    const reason = Object.freeze(Error('cancel during ' + name)), controller = new AbortController()
    await assert.rejects(run({ signal: controller.signal, fetchText: async (_url, options = {}) => {
      assert.equal(options.signal, controller.signal)
      controller.abort(reason)
      return 'Transport deliberately returned after caller cancellation'
    } }), error => error === reason)
  })

  test(`${name} default HTTP transport stops on the exact immutable caller reason without retry`, async t => {
    const reason = Object.freeze(Error('cancel real HTTP boundary for ' + name)), controller = new AbortController()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async (_url, options = {}) => {
      requests += 1
      controller.abort(reason)
      if (!options.signal?.aborted) throw Object.assign(Error('Caller signal did not reach the native HTTP transport'), { abortRetries: true })
      options.signal.throwIfAborted()
    })
    await assert.rejects(run({ signal: controller.signal }), error => error === reason)
    assert.equal(requests, 1)
  })
}
