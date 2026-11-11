// Authored failure controls for the actual default-fetch path; no native capture.
import assert from 'node:assert/strict'
import test from 'node:test'

import { run } from '../scraper/globallogic/script.js'

const activeTimeouts = () => process.getActiveResourcesInfo().filter(kind => kind === 'Timeout').length

for (const stage of ['fetch', 'body']) {
  test(`GlobalLogic clears its request timer after ${stage} rejection`, async (context) => {
    const failure = new Error(`Authored ${stage} failure`)
    const requested = []
    const createdTimers = []
    const delays = []
    let bodyReads = 0
    const originalSetTimeout = globalThis.setTimeout
    context.mock.method(globalThis, 'setTimeout', (...args) => {
      const timer = Reflect.apply(originalSetTimeout, globalThis, args)
      createdTimers.push(timer)
      delays.push(args[1])
      return timer
    })
    context.mock.method(globalThis, 'fetch', async (url, init) => {
      requested.push({ url, init })
      if (stage === 'fetch') throw failure
      return {
        status: 200,
        headers: {},
        text: async () => { bodyReads++; throw failure },
      }
    })
    const baselineTimeouts = activeTimeouts()

    try {
      await assert.rejects(run(), error => error === failure)
      assert.equal(requested.length, 1)
      assert.equal(requested[0].url, 'https://www.globallogic.com/careers/')
      assert.equal(requested[0].init.redirect, 'manual')
      assert.ok(requested[0].init.signal instanceof AbortSignal)
      assert.equal(requested[0].init.signal.aborted, false)
      assert.deepEqual(delays, [15000], 'Keep the existing request timeout budget')
      assert.equal(bodyReads, stage === 'body' ? 1 : 0)
      assert.equal(activeTimeouts(), baselineTimeouts, 'No request timer may keep the event loop alive after rejection')
    } finally {
      // Clear only handles observed in this test so the failing preimage exits.
      for (const timer of createdTimers) clearTimeout(timer)
    }
  })
}
