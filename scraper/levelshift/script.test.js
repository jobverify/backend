import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HOMEPAGE_URL,
  buildIndiaListingUrl,
  defaultFetchJson,
  defaultFetchText,
} from './script.js'

test('LevelShift default text fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const html = await defaultFetchText(HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        ok: true,
        status: 200,
        url,
        text: async () => '<html><body>LevelShift</body></html>',
      }
    },
  })

  assert.equal(html, '<html><body>LevelShift</body></html>')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('LevelShift default JSON fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const payload = await defaultFetchJson(buildIndiaListingUrl(), {
    method: 'POST',
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        ok: true,
        status: 200,
        url,
        json: async () => ({ jobs: { requirements: [] } }),
      }
    },
  })

  assert.deepEqual(payload, { jobs: { requirements: [] } })
  assert.equal(capturedInit.method, 'POST')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('LevelShift default JSON fetch retries the India listing API with a narrow TLS fallback on certificate failures', async () => {
  let insecureCall = null
  const body = new FormData()
  body.append('filterjson', JSON.stringify({ country: 'ind' }))

  const payload = await defaultFetchJson(buildIndiaListingUrl(), {
    method: 'POST',
    body,
    timeoutMs: 25,
    fetchImpl: async () => {
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        message: 'unable to verify the first certificate',
      }
      throw error
    },
    insecureFetchJsonImpl: async (url, init = {}) => {
      insecureCall = { url, init }
      return { jobs: { requirements: [] } }
    },
  })

  assert.deepEqual(payload, { jobs: { requirements: [] } })
  assert.equal(insecureCall?.url, buildIndiaListingUrl())
  assert.equal(insecureCall?.init?.method, 'POST')
  assert.equal(insecureCall?.init?.body, 'filterjson=%7B%22country%22%3A%22ind%22%7D')
  assert.match(
    String(insecureCall?.init?.headers?.['Content-Type'] || insecureCall?.init?.headers?.['content-type'] || ''),
    /application\/x-www-form-urlencoded/i,
  )
})
