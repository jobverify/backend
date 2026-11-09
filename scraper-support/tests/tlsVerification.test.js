import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import test from 'node:test'

import { createBrowserFetchSession } from '../shared/browserFetch.js'
import { fetchPageWithRetry } from '../utils/fetchPageWithRetry.js'

const buildCertificateError = () => {
  const error = new Error('unable to verify the first certificate')
  error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  return error
}

const failHttpsRequestsWithCertificateError = (seenOptions) => {
  const originalRequest = https.request

  https.request = (_url, options) => {
    seenOptions.push(options)
    const request = new EventEmitter()
    request.setTimeout = () => request
    request.write = () => true
    request.end = () => {
      queueMicrotask(() => request.emit('error', buildCertificateError()))
    }
    request.destroy = (error) => {
      queueMicrotask(() => request.emit('error', error))
    }
    return request
  }

  return () => {
    https.request = originalRequest
  }
}

test('fetchPageWithRetry does not retry certificate failures with TLS verification disabled', async () => {
  const requestOptions = []
  const restoreHttpsRequest = failHttpsRequestsWithCertificateError(requestOptions)

  try {
    await assert.rejects(
      fetchPageWithRetry('https://jobs.clariontechnologies.co.in/featured-job', {
        attempts: 1,
        baseDelayMs: 1,
        label: 'tls-test',
        allowInsecureTlsHosts: ['jobs.clariontechnologies.co.in'],
      }),
      /unable to verify/i,
    )

    assert.equal(requestOptions.length, 1)
    assert.equal(requestOptions[0].rejectUnauthorized, true)
  } finally {
    restoreHttpsRequest()
  }
})

test('browser fetch session propagates certificate failures without insecure HTTPS fallback', async () => {
  const originalFetch = globalThis.fetch
  const requestOptions = []
  const restoreHttpsRequest = failHttpsRequestsWithCertificateError(requestOptions)

  globalThis.fetch = async () => {
    throw buildCertificateError()
  }

  try {
    const session = await createBrowserFetchSession({ ignoreHTTPSErrors: true })

    await assert.rejects(
      session.fetchText('https://example.test/careers'),
      /unable to verify/i,
    )

    assert.equal(requestOptions.length, 0)
  } finally {
    globalThis.fetch = originalFetch
    restoreHttpsRequest()
  }
})
