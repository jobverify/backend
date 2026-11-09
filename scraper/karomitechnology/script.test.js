import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  HOMEPAGE_URL,
  defaultFetchJson,
  defaultFetchText,
} from './script.js'

test('Karomi Technology default text fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const html = await defaultFetchText(HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        ok: true,
        status: 200,
        url,
        text: async () => '<html><body>Karomi</body></html>',
      }
    },
  })

  assert.equal(html, '<html><body>Karomi</body></html>')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Karomi Technology default JSON fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const payload = await defaultFetchJson(CAREERS_API_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        ok: true,
        status: 200,
        url,
        json: async () => ({ code: 'success', data: [] }),
      }
    },
  })

  assert.deepEqual(payload, { code: 'success', data: [] })
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})
