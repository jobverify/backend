import assert from 'node:assert/strict'
import test from 'node:test'

const BLOCKED_CAREERS_HTML = `
<html>
  <title>You are being redirected...</title>
  <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
  <script>var sucuri_cloudproxy_js='enabled';</script>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Xcaliber Infotech returns [] when the verified blocked careers shell is wrapped in an HTTP 307 response', async () => {
  const xcaliber = await loadModule()
  assert.ok(xcaliber, 'Xcaliber Infotech scraper module should load')

  const blockedResponseError = new Error('HTTP 307 for https://xcaliberinfotech.com/search-jobs/')
  blockedResponseError.status = 307
  blockedResponseError.responseBody = BLOCKED_CAREERS_HTML

  const jobs = await xcaliber.createXcaliberInfotechScraper().run({
    fetchText: async () => {
      throw blockedResponseError
    },
  })

  assert.deepEqual(jobs, [])
})

test('Xcaliber Infotech returns [] when the verified blocked careers shell is wrapped inside the fetch retry error chain', async () => {
  const xcaliber = await loadModule()
  assert.ok(xcaliber, 'Xcaliber Infotech scraper module should load')

  const blockedResponseError = new Error('HTTP 307 for https://xcaliberinfotech.com/search-jobs/')
  blockedResponseError.status = 307
  blockedResponseError.responseBody = BLOCKED_CAREERS_HTML

  const retryWrappedError = new Error(
    '[xcaliberinfotech-html] All 3 attempts failed. Last error: HTTP 307 for https://xcaliberinfotech.com/search-jobs/',
  )
  retryWrappedError.abortRetries = true
  retryWrappedError.cause = blockedResponseError

  const jobs = await xcaliber.createXcaliberInfotechScraper().run({
    fetchText: async () => {
      throw retryWrappedError
    },
  })

  assert.deepEqual(jobs, [])
})
