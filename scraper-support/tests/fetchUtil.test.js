import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchJsonWithRetry, fetchTextWithRetry, parseRetryAfterHeader } from '../utils/fetch.js'
import { withRetry } from '../utils/retry.js'

test('text fetch metadata retains the actual response URL for detail redirect validation', async () => {
  const result = await fetchTextWithRetry('https://example.com/jobs/R1', {
    includeResponseMetadata: true, attempts: 1,
    fetchImpl: async (_url, init) => {
      assert.equal(Object.hasOwn(init, 'includeResponseMetadata'), false)
      return { ok: true, status: 200, url: 'https://example.com/', text: async () => '<h1>Careers</h1>' }
    },
  })
  assert.deepEqual(result, { html: '<h1>Careers</h1>', status: 200, url: 'https://example.com/' })
})

test('JSON fetch metadata retains the native endpoint and payload for detail identity checks', async () => {
  const url = 'https://example.com/api/jobs/R1'
  const result = await fetchJsonWithRetry(url, {
    includeResponseMetadata: true, attempts: 1,
    fetchImpl: async () => ({ ok: true, status: 200, url, json: async () => ({ Id: 'R1' }) }),
  })
  assert.deepEqual(result, { payload: { Id: 'R1' }, status: 200, url })
})

test('fetchJsonWithRetry retries transient fetch failures before returning JSON', async () => {
  let attempts = 0

  const result = await fetchJsonWithRetry('https://example.com/jobs', {
    attempts: 2,
    baseDelayMs: 1,
    timeoutMs: 50,
    label: 'test-json',
    fetchImpl: async () => {
      attempts += 1
      if (attempts === 1) {
        throw new TypeError('fetch failed')
      }

      return {
        ok: true,
        json: async () => ({ jobs: 3 }),
      }
    },
  })

  assert.deepEqual(result, { jobs: 3 })
  assert.equal(attempts, 2)
})

test('fetchTextWithRetry throws an HTTP error after exhausting retries', async () => {
  await assert.rejects(
    fetchTextWithRetry('https://example.com/careers', {
      attempts: 2,
      baseDelayMs: 1,
      timeoutMs: 50,
      label: 'test-text',
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      }),
    }),
    /All 2 attempts failed\. Last error: HTTP 503 for https:\/\/example\.com\/careers/,
  )
})

test('fetchTextWithRetry treats deterministic HTTP 403 responses as non-retriable', async () => {
  let attempts = 0

  await assert.rejects(
    fetchTextWithRetry('https://example.com/blocked', {
      attempts: 3,
      baseDelayMs: 1,
      timeoutMs: 50,
      label: 'blocked-text',
      fetchImpl: async () => {
        attempts += 1
        return {
          ok: false,
          status: 403,
          headers: {
            get: () => null,
          },
          text: async () => 'forbidden',
        }
      },
    }),
    (error) => {
      assert.match(
        error.message,
        /\[blocked-text\] Retry aborted after attempt 1\/3\. Last error: HTTP 403 for https:\/\/example\.com\/blocked/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('fetchTextWithRetry aborts outer scraper retries after exhausting its own retry budget', async () => {
  let fetchAttempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/careers', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'inner-fetch',
        fetchImpl: async () => {
          fetchAttempts += 1
          throw new TypeError('fetch failed')
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-scraper',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-scraper\] Retry aborted after attempt 1\/2\. Last error: \[inner-fetch\] All 3 attempts failed\. Last error: fetch failed/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(fetchAttempts, 3)
})

test('fetchTextWithRetry treats DNS resolution failures as non-retriable transport errors', async () => {
  let attempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/missing-host', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'missing-host-fetch',
        fetchImpl: async () => {
          attempts += 1
          const dnsError = new Error('getaddrinfo ENOTFOUND missing.example.com')
          dnsError.code = 'ENOTFOUND'
          const fetchError = new TypeError('fetch failed')
          fetchError.cause = dnsError
          throw fetchError
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-missing-host',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-missing-host\] Retry aborted after attempt 1\/2\. Last error: \[missing-host-fetch\] Retry aborted after attempt 1\/3\. Last error: fetch failed \| getaddrinfo ENOTFOUND missing\.example\.com/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('fetchTextWithRetry bounds temporary DNS retries without restarting the outer scraper', async () => {
  let attempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/flaky-host', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'flaky-host-fetch',
        fetchImpl: async () => {
          attempts += 1
          const dnsError = new Error('getaddrinfo EAI_AGAIN flaky.example.com')
          dnsError.code = 'EAI_AGAIN'
          const fetchError = new TypeError('fetch failed')
          fetchError.cause = dnsError
          throw fetchError
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-flaky-host',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-flaky-host\] Retry aborted after attempt 1\/2\. Last error: \[flaky-host-fetch\] All 3 attempts failed\. Last error: fetch failed \| getaddrinfo EAI_AGAIN flaky\.example\.com/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 3)
})

test('fetchTextWithRetry treats deterministic HTTP protocol parse failures as non-retriable transport errors', async () => {
  let attempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/broken-origin', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'broken-origin-fetch',
        fetchImpl: async () => {
          attempts += 1
          throw new TypeError(
            'fetch failed | Response does not match the HTTP/1.1 protocol (Missing expected CR after header value)',
          )
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-broken-origin',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-broken-origin\] Retry aborted after attempt 1\/2\. Last error: \[broken-origin-fetch\] Retry aborted after attempt 1\/3\. Last error: fetch failed \| Response does not match the HTTP\/1\.1 protocol \(Missing expected CR after header value\)/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('fetchTextWithRetry treats deterministic invalid-header parser failures as non-retriable transport errors', async () => {
  let attempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/invalid-header-origin', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'invalid-header-origin-fetch',
        fetchImpl: async () => {
          attempts += 1
          throw new TypeError(
            'fetch failed | Response does not match the HTTP/1.1 protocol (Invalid header value char)',
          )
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-invalid-header-origin',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-invalid-header-origin\] Retry aborted after attempt 1\/2\. Last error: \[invalid-header-origin-fetch\] Retry aborted after attempt 1\/3\. Last error: fetch failed \| Response does not match the HTTP\/1\.1 protocol \(Invalid header value char\)/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('fetchTextWithRetry treats certificate-expired transport failures as non-retriable transport errors', async () => {
  let attempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/expired-cert', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'expired-cert-fetch',
        fetchImpl: async () => {
          attempts += 1
          const tlsError = new Error('certificate has expired')
          tlsError.code = 'CERT_HAS_EXPIRED'
          const fetchError = new TypeError('fetch failed')
          fetchError.cause = tlsError
          throw fetchError
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-expired-cert',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-expired-cert\] Retry aborted after attempt 1\/2\. Last error: \[expired-cert-fetch\] Retry aborted after attempt 1\/3\. Last error: fetch failed \| certificate has expired/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('fetchTextWithRetry treats certificate-chain verification failures as non-retriable transport errors', async () => {
  let attempts = 0

  await assert.rejects(
    withRetry(
      () => fetchTextWithRetry('https://example.com/untrusted-chain', {
        attempts: 3,
        baseDelayMs: 1,
        timeoutMs: 50,
        label: 'untrusted-chain-fetch',
        fetchImpl: async () => {
          attempts += 1
          const tlsError = new Error('unable to verify the first certificate')
          tlsError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
          const fetchError = new TypeError('fetch failed')
          fetchError.cause = tlsError
          throw fetchError
        },
      }),
      {
        attempts: 2,
        baseDelayMs: 1,
        label: 'outer-untrusted-chain',
      },
    ),
    (error) => {
      assert.match(
        error.message,
        /\[outer-untrusted-chain\] Retry aborted after attempt 1\/2\. Last error: \[untrusted-chain-fetch\] Retry aborted after attempt 1\/3\. Last error: fetch failed \| unable to verify the first certificate/,
      )
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('fetchJsonWithRetry reports forbidden HTML bodies without JSON parser noise', async () => {
  await assert.rejects(
    fetchJsonWithRetry('https://example.com/jobs.json', {
      attempts: 1,
      baseDelayMs: 1,
      timeoutMs: 50,
      label: 'test-json-html',
      fetchImpl: async () => ({
        ok: true,
        headers: {
          get: () => 'text/html; charset=utf-8',
        },
        text: async () => '<html><head><title>Forbidden Access</title></head><body>Forbidden</body></html>',
      }),
    }),
    /Forbidden HTML response for https:\/\/example\.com\/jobs\.json/,
  )
})

test('fetchTextWithRetry composes caller cancellation with its local request deadline', async () => {
  const controller = new AbortController()
  const abortReason = new Error('source budget expired')
  abortReason.abortRetries = true
  let attempts = 0

  const request = fetchTextWithRetry('https://example.com/careers', {
    attempts: 3,
    timeoutMs: 1000,
    signal: controller.signal,
    fetchImpl: async (_url, options = {}) => {
      attempts += 1
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(options.signal.reason)
        }, { once: true })
      })
    },
  })
  controller.abort(abortReason)

  await assert.rejects(
    Promise.race([
      request,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('caller cancellation was not propagated')), 100)
      }),
    ]),
    (error) => (
      error === abortReason
      || (
        error?.abortRetries === true
        && String(error?.message || '').includes('source budget expired')
      )
    ),
  )
  assert.equal(attempts, 1)
})

test('fetchTextWithRetry aborts Retry-After backoff promptly with the exact caller reason', async () => {
  const controller = new AbortController()
  const abortReason = new Error('source budget expired during retry backoff')
  let attempts = 0
  let watchdog

  const startedAt = Date.now()
  const request = fetchTextWithRetry('https://example.com/rate-limited', {
    attempts: 3,
    baseDelayMs: 1,
    timeoutMs: 1000,
    signal: controller.signal,
    fetchImpl: async () => {
      attempts += 1
      return {
        ok: false,
        status: 429,
        headers: {
          get: (name) => (
            String(name).toLowerCase() === 'retry-after'
              ? '0.5'
              : null
          ),
        },
      }
    },
  })

  setTimeout(() => controller.abort(abortReason), 10)

  try {
    await assert.rejects(
      Promise.race([
        request,
        new Promise((_, reject) => {
          watchdog = setTimeout(
            () => reject(new Error('retry backoff ignored caller cancellation')),
            150,
          )
        }),
      ]),
      (error) => error === abortReason,
    )
  } finally {
    clearTimeout(watchdog)
  }

  assert.equal(attempts, 1)
  assert.ok(
    Date.now() - startedAt < 150,
    'Expected caller cancellation to clear the Retry-After timer promptly',
  )
})

test('parseRetryAfterHeader supports delta-seconds and HTTP-date values', async () => {
  assert.equal(parseRetryAfterHeader('1', 0), 1000)
  assert.equal(
    parseRetryAfterHeader('Fri, 24 Jul 2026 00:00:01 GMT', Date.parse('Fri, 24 Jul 2026 00:00:00 GMT')),
    1000,
  )
  assert.equal(parseRetryAfterHeader('not-a-date', 0), null)
})
