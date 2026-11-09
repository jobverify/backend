import assert from 'node:assert/strict'
import test from 'node:test'
import { run, FIRST_PARTY_ROOT_URL } from './script.js'

test('lidolearning retains HTTP status and both request and final URL on failed responses', async () => {
  for (const [status, finalUrl] of [[503, FIRST_PARTY_ROOT_URL], [200, 'https://unrelated.invalid/']]) {
    let cancelled = false
    await assert.rejects(run({ fetchImpl: async () => ({
      status, url: finalUrl, body: { cancel() { cancelled = true } },
      text() { assert.fail('Rejected response body must remain unread') },
    }) }), error => {
      assert.equal(error.status, status)
      assert.equal(error.requestUrl, FIRST_PARTY_ROOT_URL)
      assert.equal(error.finalUrl, finalUrl)
      assert.match(error.message, new RegExp('HTTP ' + status))
      assert.ok(error.message.includes(FIRST_PARTY_ROOT_URL))
      assert.ok(error.message.includes(finalUrl))
      assert.equal(error.retainedResponses.at(-1).status, status)
      assert.equal(error.retainedResponses.at(-1).finalUrl, finalUrl)
      assert.equal(error.lifecycleCleanupAllowed, false)
      return true
    })
    assert.equal(cancelled, true)
  }
})
