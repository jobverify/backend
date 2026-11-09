import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE network tripwire') }
const {
  JOBS_ARCHIVE_URL,
  defaultFetchPage,
} = await import('./script.js')

test('KEI Industries default fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const page = await defaultFetchPage(JOBS_ARCHIVE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        text: async () => '<html><body>Job Archives</body></html>',
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, JOBS_ARCHIVE_URL)
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})
