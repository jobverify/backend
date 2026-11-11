import test from 'node:test'
import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { runNativeBanyan, CAREERS_URL } from '../scraper/banyansoftware/nativeRun.js'

// Authored supported transport/body protocols, not employer captures. The
// two-read response and three-read boxed-string body behavior is retained from
// the exact pre-cancellation source; native policy failures remain unchanged.
for (const stage of ['response', 'body']) {
  for (const mode of ['raw', 'native-promise', 'thenable']) {
    for (const budget of [null, 1, 2, 3]) {
      test(`Banyan ${stage} ${mode} then budget ${budget} preserves existing resolution`, async () => {
        const caller = new AbortController()
        const primary = Object.freeze(Error('Authored existing then getter primary'))
        let reads = 0
        let calls = 0
        let bodies = 0
        let thenCalls = 0
        const observed = stage === 'body' ? Object('Authored invalid native careers HTML') : {
          status: 403, ok: false, url: CAREERS_URL,
          text() { bodies++; return '' },
        }
        Object.defineProperty(observed, 'then', { get() {
          reads++
          if (budget !== null && reads > budget) throw primary
          return undefined
        } })
        const produce = () => mode === 'native-promise' ? Promise.resolve(observed)
          : mode === 'thenable' ? { then(resolve) { thenCalls++; resolve(observed) } } : observed
        let error
        try {
          await runNativeBanyan({ signal: caller.signal, fetchImpl(url) {
            calls++
            assert.equal(url, CAREERS_URL)
            if (stage === 'response') return produce()
            return { status: 200, ok: true, url, text() { bodies++; return produce() } }
          } })
        } catch (caught) { error = caught }
        const ordinaryReads = stage === 'response' ? 2 : 3
        const expectedReads = budget === null ? ordinaryReads : Math.min(budget + 1, ordinaryReads)
        assert.equal(reads, expectedReads)
        if (budget !== null && budget < ordinaryReads) assert.equal(error, primary)
        else {
          assert.notEqual(error, primary)
          assert.match(error.message, /Banyan native inventory:/)
        }
        assert.equal(calls, 1)
        assert.equal(bodies, stage === 'body' ? 1 : 0)
        assert.equal(thenCalls, mode === 'thenable' ? 1 : 0)
        assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
      })
    }
  }
}

for (const mode of ['raw', 'native-promise', 'thenable']) {
  test(`Banyan native Response ${mode} retains text receiver and native guard`, async () => {
    const caller = new AbortController()
    const value = new Response('Authored invalid native careers HTML', { status: 200 })
    Object.defineProperty(value, 'url', { value: CAREERS_URL })
    let calls = 0
    let error
    try {
      await runNativeBanyan({ signal: caller.signal, fetchImpl() {
        calls++
        return mode === 'raw' ? value : mode === 'native-promise' ? Promise.resolve(value)
          : { then(resolve) { resolve(value) } }
      } })
    } catch (caught) { error = caught }
    assert.match(error.message, /Banyan native inventory:/)
    assert.equal(value.bodyUsed, true)
    assert.equal(calls, 1)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  })
}
