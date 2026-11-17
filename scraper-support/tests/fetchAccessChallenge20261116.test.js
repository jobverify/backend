import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../utils/fetch.js'
import { getRetryMetadata } from '../utils/retry.js'
import { requireNativeHttpResponse } from '../shared/nativeHttpResponse.js'
import { classifyScraperError } from '../utils/failureClassification.js'

const URL = 'https://public-recruitment.example/jobs'
const challenge = (status, responseUrl = URL) => Object.defineProperty(new Response('<html><body>Verify you are human</body></html>', {
  status, headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html', 'retry-after': '0' },
}), 'url', { value: responseUrl })

for (const [label, fetcher] of [['JSON', fetchJsonWithRetry], ['HTML', fetchTextWithRetry]]) {
  for (const status of [200, 403, 429]) test('shared ' + label + ' fetch stops a declared access challenge with HTTP ' + status, async () => {
    let requests = 0
    await assert.rejects(fetcher(URL, { attempts: 3, baseDelayMs: 0, fetchImpl: async () => {
      requests++
      return challenge(status)
    } }), error => {
      assert.deepEqual(classifyScraperError(error), {
        softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied',
      })
      assert.equal(error.status, status)
      assert.equal(error.httpStatus, status)
      assert.equal(error.accessChallenge, true)
      assert.equal(error.requestedUrl, URL)
      assert.equal(error.responseUrl, URL)
      assert.equal(error.lifecycleCleanupAllowed, false)
      assert.equal(error.sourceScopeComplete, false)
      assert.equal(error.abortRetries, true)
      assert.deepEqual(getRetryMetadata(error), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
      return true
    })
    assert.equal(requests, 1)
  })
}

test('native response validation rejects a declared challenge with HTTP 200 before parsing its body', async () => {
  const response = challenge(200)
  await assert.rejects(requireNativeHttpResponse(response, URL), error => {
    assert.equal(classifyScraperError(error).failureKind, 'blocked_or_access_denied')
    assert.equal(error.accessChallenge, true)
    assert.equal(error.sourceScopeComplete, false)
    return true
  })
  assert.equal(response.bodyUsed, true, 'the rejected response must be disposed')
})

test('native response validation retains a hard identity failure for a challenge from another URL', async () => {
  await assert.rejects(requireNativeHttpResponse(challenge(200, 'https://foreign.example/'), URL), error => {
    assert.equal(classifyScraperError(error).failureKind, 'parser_or_contract_error')
    assert.equal(error.softFailure, false)
    return true
  })
})
