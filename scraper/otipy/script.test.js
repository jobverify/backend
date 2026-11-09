import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HOMEPAGE_URL,
  defaultFetchPage,
} from './script.js'

test('Otipy default fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const page = await defaultFetchPage(HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 403,
        url,
        text: async () => '<html><body>Access is restricted</body></html>',
      }
    },
  })

  assert.equal(page.status, 403)
  assert.equal(page.url, HOMEPAGE_URL)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})
