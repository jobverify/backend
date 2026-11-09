import assert from 'node:assert/strict'
import test from 'node:test'
import {createCatalogScraper, getScraperCatalog} from '../scraper-support/providers/index.js'
import {getRetryMetadata, withRetry} from '../scraper-support/utils/retry.js'

const primaryBySource = {
  doximity: 'https://work.doximity.com/positions/',
  hiddenbrainsinfotech: 'https://www.hiddenbrains.com/careers.html',
  sigmasolve: 'https://www.sigmasolve.com/who-we-are/openings',
  xponentai: 'https://xponent.ai/career/',
  zietatechnologies: 'https://www.zietatech.com/index.php?page=careers',
}
const providers = new Map(getScraperCatalog().map(row => [row.source, row]))
const failed = async promise => {
  let failure
  await assert.rejects(promise, error => { failure = error; return true })
  return failure
}

for (const [source, primary] of Object.entries(primaryBySource)) {
  const provider = providers.get(source)
  test(source + ' retains primary HTTP403 evidence and prevents the outer retry', async () => {
    const body = Buffer.from('Controlled primary denial \u00e9'), requests = []
    const error = await failed(withRetry(() => createCatalogScraper(provider).run({
      rateLimitMs: 0,
      fetchImpl: async (input, init) => {
        assert.equal(String(input), primary)
        assert.equal(init.method, 'GET')
        assert.equal(init.redirect, 'manual')
        assert.equal(init.credentials, 'omit')
        requests.push(String(input))
        const response = new Response(body, {status: 403, headers: {'content-type': 'text/html; charset=utf-8'}})
        Object.defineProperty(response, 'url', {value: primary})
        return response
      },
    }), {attempts: 2, baseDelayMs: 0, label: source + '-controlled-primary-denial'}))
    assert.deepEqual(requests, [primary])
    assert.equal(error.cause.status, 403)
    assert.equal(error.cause.abortRetries, true)
    assert.equal(error.cause.failureKind, 'blocked_or_access_denied')
    assert.equal(error.cause.sourceScopeComplete, false)
    assert.equal(error.cause.lifecycleCleanupAllowed, false)
    assert.deepEqual(getRetryMetadata(error), {attemptsUsed: 1, retries: 0, retryDelayMs: 0})
    const evidence = error.cause.nativeEvidence
    assert.equal(evidence.sourceScopeComplete, false)
    assert.equal(evidence.lifecycleCleanupAllowed, false)
    assert.equal(evidence.rawResponses.length, 1)
    const response = evidence.rawResponses[0].response
    assert.equal(response.status, 403)
    assert.equal(response.rawBodyBase64, body.toString('base64'))
    assert.equal(response.bodyComplete, true)
  })

  for (const abortRetries of [true, false]) test(source + ' preserves frozen producer retry directive ' + abortRetries, async () => {
    const reason = Object.freeze(Object.assign(new Error('Controlled transient producer failure'), {abortRetries}))
    let calls = 0
    const error = await failed(withRetry(() => createCatalogScraper(provider).run({
      rateLimitMs: 0, fetchImpl: async () => { calls++; throw reason },
    }), {attempts: 2, baseDelayMs: 0, label: source + '-controlled-producer'}))
    assert.equal(calls, abortRetries ? 1 : 2)
    assert.equal(error.cause.abortRetries, abortRetries)
    assert.equal(error.cause.status, undefined)
    assert.deepEqual(getRetryMetadata(error), {attemptsUsed: abortRetries ? 1 : 2, retries: abortRetries ? 0 : 1, retryDelayMs: 0})
    const seen = new Set()
    let at = error, preserved = false
    while (at && !seen.has(at)) { seen.add(at); if (at === reason) preserved = true; at = at.cause }
    assert.equal(preserved, true)
    assert.equal(reason.abortRetries, abortRetries)
  })

  test(source + ' preserves exact opaque caller cancellation before any acquisition', async () => {
    const reason = Object.freeze({cancel: source}), controller = new AbortController()
    controller.abort(reason)
    let calls = 0
    await assert.rejects(createCatalogScraper(provider).run({
      signal: controller.signal, fetchImpl: async () => { calls++; assert.fail('Cancelled source cannot acquire a response') },
    }), error => error === reason)
    assert.equal(calls, 0)
  })
}
