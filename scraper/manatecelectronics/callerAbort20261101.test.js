import assert from 'node:assert/strict'
import test from 'node:test'
import { run, HOMEPAGE_URL } from './script.js'

const reasons = [
  ['typed frozen Error', () => Object.freeze(Object.assign(new Error('caller stop'), { code: 'MANATEC_INVENTORY_UNAVAILABLE' }))],
  ['typed frozen object', () => Object.freeze({ code: 'MANATEC_INVENTORY_UNAVAILABLE', note: 'caller-owned' })],
  ['ordinary frozen Error', () => Object.freeze(new Error('caller stop'))],
  ['string', () => 'caller stop'],
  ['null', () => null],
  ['default AbortError', () => undefined],
  ['throwing code getter', () => Object.freeze({ get code() { throw Error('Caller reason must stay opaque') } })],
  ['throwing inventory surface getter', () => Object.freeze({ code: 'MANATEC_INVENTORY_UNAVAILABLE', get surface() { throw Error('Caller reason must stay opaque') } })],
]
for (const phase of ['pre-aborted', 'pending request']) for (const [kind, makeReason] of reasons) {
  test('Manatec preserves exact caller reason for ' + phase + ': ' + kind, async () => {
    const controller = new AbortController(), reason = makeReason(), requested = []
    if (phase === 'pre-aborted') controller.abort(reason)
    await assert.rejects(run({ signal: controller.signal, timeoutMs: 500, fetchPage: async (url, options) => {
      requested.push(url)
      assert.ok(options.signal instanceof AbortSignal)
      assert.equal(options.signal.aborted, false)
      controller.abort(reason)
      assert.equal(options.signal.aborted, true)
      return new Promise(() => {})
    } }), error => error === controller.signal.reason)
    assert.deepEqual(requested, phase === 'pre-aborted' ? [] : [HOMEPAGE_URL])
  })
}
