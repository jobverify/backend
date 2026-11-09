import assert from 'node:assert/strict'
import test from 'node:test'
import {createCatalogScraper, getScraperCatalog} from '../scraper-support/providers/index.js'
import {getRetryMetadata, withRetry} from '../scraper-support/utils/retry.js'

test('registered Cribl primary denial prevents the outer retry loop from acquiring the page again', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'cribl')
  const primary = 'https://cribl.io/careers/'
  const body = Buffer.from('Controlled primary denial')
  const requests = []
  let failure
  await assert.rejects(withRetry(() => createCatalogScraper(provider).run({
    rateLimitMs: 0,
    fetchImpl: async (input, init) => {
      requests.push(String(input))
      assert.equal(String(input), primary)
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      const response = new Response(body, {status: 403, headers: {'content-type': 'text/html'}})
      Object.defineProperty(response, 'url', {value: primary})
      return response
    },
  }), {attempts: 2, baseDelayMs: 0, label: 'cribl-controlled-primary-denial'}), error => {
    failure = error
    assert.equal(error.cause.status, 403)
    assert.equal(error.cause.failureKind, 'blocked_or_access_denied')
    return true
  })
  assert.deepEqual(requests, [primary], 'The source annotation must preserve the transport no-retry decision')
  assert.equal(failure.cause.abortRetries, true)
  assert.equal(failure.abortRetries, true)
  assert.deepEqual(getRetryMetadata(failure), {attemptsUsed: 1, retries: 0, retryDelayMs: 0})
  const evidence = failure.cause.nativeEvidence
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.rawResponses.length, 1)
  const response = evidence.rawResponses[0].response
  assert.equal(response.status, 403)
  assert.equal(response.rawBodyBase64, body.toString('base64'))
  assert.equal(response.bodyComplete, true)
})
