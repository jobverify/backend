import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  defaultFetchPage,
} from './script.js'

test('Knowlarity default fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const page = await defaultFetchPage(CAREERS_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        text: async () => '<html><body>Knowlarity careers</body></html>',
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, CAREERS_URL)
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Knowlarity default fetch uses verified native HTTPS for the exact first-party host when Node lacks the issuer chain', async () => {
  const calls = []
  const page = await defaultFetchPage(CAREERS_URL, {
    fetchImpl: async () => {
      const error = new Error('fetch failed')
      error.cause = Object.assign(new Error('unable to verify the first certificate'), {
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      })
      throw error
    },
    execFile: async (file, args, options) => {
      calls.push({ file, args, options })
      return {
        stdout: '<html><title>Knowlarity careers</title></html>\n__KNOWLARITY_CURL_METADATA__200\thttps://www.knowlarity.com/careers',
      }
    },
  })

  assert.deepEqual(page, {
    status: 200,
    url: CAREERS_URL,
    html: '<html><title>Knowlarity careers</title></html>',
  })
  assert.equal(calls[0].file, process.platform === 'win32' ? 'curl.exe' : 'curl')
  assert.equal(calls[0].args.includes('--insecure'), false)
  assert.equal(calls[0].args.includes('-k'), false)
  assert.deepEqual(calls[0].args.slice(-3), ['--proto-redir', '=https', CAREERS_URL])
  assert.equal(calls[0].options.windowsHide, true)
})
