import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'

test('Bio-Rad preserves HTTP status and request/final URLs for transport contract failures', async t => {
  for (const [status, finalUrl] of [[202, CAREERS_URL], [200, 'https://unrelated.invalid/']]) {
    const mocked = t.mock.method(globalThis, 'fetch', async () => ({ status, url: finalUrl }))
    try {
      await assert.rejects(run(), error => {
        assert.equal(error.status, status)
        assert.equal(error.requestUrl, CAREERS_URL)
        assert.equal(error.finalUrl, finalUrl)
        assert.match(error.message, new RegExp('HTTP ' + status))
        assert.ok(error.message.includes(CAREERS_URL))
        assert.ok(error.message.includes(finalUrl))
        return true
      })
    } finally { mocked.mock.restore() }
  }
})
