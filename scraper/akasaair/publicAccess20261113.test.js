import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, CAREERS_REDIRECT_URL } from './script.js'
const html = gunzipSync(readFileSync(new URL('./fixtures/public-403-20261113.html.gz', import.meta.url))).toString()
test('Akasa current public403 is an upstream access failure and stops source acquisition', async () => {
  let calls = 0
  await assert.rejects(run({ fetchPage: async url => {
    calls++
    assert.equal(url, CAREERS_REDIRECT_URL)
    return { status: 403, url, html }
  } }), error => {
    assert.equal(error.softFailure, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.failureKind, 'public_access_denied')
    assert.match(error.message, /HTTP 403/)
    return true
  })
  assert.equal(calls, 1)
})
