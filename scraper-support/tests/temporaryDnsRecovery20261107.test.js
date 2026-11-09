import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchTextWithRetry } from '../utils/fetch.js'
import { withRetry, getRetryMetadata } from '../utils/retry.js'

const temporaryDnsFailure = () => new TypeError('fetch failed', {
  cause: Object.assign(new Error('getaddrinfo EAI_AGAIN cbip.org'), { code: 'EAI_AGAIN' }),
})

test('a temporary DNS failure can recover within the single shared fetch budget', async () => {
  let requests = 0
  const result = await fetchTextWithRetry('https://cbip.org/', {
    attempts: 3,
    baseDelayMs: 0,
    fetchImpl: async () => {
      if (++requests === 1) throw temporaryDnsFailure()
      return new Response('<h1>Central Board of Irrigation and Power</h1>')
    },
  })
  assert.match(result, /Central Board of Irrigation and Power/)
  assert.equal(requests, 2)
})

test('persistent temporary DNS failures exhaust one inner budget without multiplying outer retries', async () => {
  let requests = 0
  await assert.rejects(withRetry(() => fetchTextWithRetry('https://cbip.org/', {
    attempts: 3,
    baseDelayMs: 0,
    fetchImpl: async () => { requests++; throw temporaryDnsFailure() },
  }), { attempts: 4, baseDelayMs: 0 }), error => {
    assert.equal(error.code, 'EAI_AGAIN')
    assert.equal(error.abortRetries, true)
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    return true
  })
  assert.equal(requests, 3)
})

test('cancellation during a temporary DNS failure prevents another request', async () => {
  let requests = 0
  const controller = new AbortController(), reason = new Error('audit stopped')
  await assert.rejects(fetchTextWithRetry('https://cbip.org/', {
    attempts: 3,
    baseDelayMs: 0,
    signal: controller.signal,
    fetchImpl: async () => { requests++; controller.abort(reason); throw temporaryDnsFailure() },
  }), error => error === reason)
  assert.equal(requests, 1)
})
