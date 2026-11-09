import assert from 'node:assert/strict'
import test from 'node:test'
import { runNative } from './nativeRun.js'
import { CORPORATE } from './nativeContract.js'

test('Colgate preserves HTTP status and request/final URLs for transport contract failures', async t => {
  for (const [status, finalUrl] of [[202, CORPORATE], [200, 'https://unrelated.invalid/']]) {
    const mocked = t.mock.method(globalThis, 'fetch', async () => ({ status, url: finalUrl }))
    try {
      await assert.rejects(runNative(), error => {
        assert.equal(error.status, status)
        assert.equal(error.requestUrl, CORPORATE)
        assert.equal(error.finalUrl, finalUrl)
        assert.match(error.message, new RegExp('HTTP ' + status))
        assert.ok(error.message.includes(CORPORATE))
        assert.ok(error.message.includes(finalUrl))
        return true
      })
    } finally { mocked.mock.restore() }
  }
})
