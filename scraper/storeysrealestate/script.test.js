import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createStoreysRealEstateScraper,
  hasBrokenWordPressJsonSignal,
  hasPublicJobsSignal,
  hasRecoverableCertificateError,
  hasTimeoutError,
  hasUnavailableCareersApiSignal,
} from './script.js'

const brokenWordPressJson = (url) => ({
  status: 500,
  url,
  contentType: 'application/json; charset=UTF-8',
  html: JSON.stringify({
    code: 'internal_server_error',
    message: '<p>There has been a critical error on this website.</p><p><a href="https://wordpress.org/documentation/article/faq-troubleshooting/">Learn more about troubleshooting WordPress.</a></p>',
    data: {
      status: 500,
      error: {
        type: 1,
      },
    },
  }),
  errorMessage: '',
})

const unavailableApiPage = {
  status: 'TIMEOUT',
  url: CAREERS_API_URL,
  contentType: '',
  html: '',
  errorMessage: `timeout for ${CAREERS_API_URL}`,
}

const createCertificateExpiredError = () => {
  const cause = new Error('certificate has expired')
  cause.code = 'CERT_HAS_EXPIRED'
  return new TypeError('fetch failed', { cause })
}

const createMockTlsBypassRequest = (pagesByUrl, observedOptions) =>
  (parsedUrl, options, callback) => {
    const url = parsedUrl.toString()
    let errorHandler = null

    return {
      setTimeout() {},
      destroy(error) {
        errorHandler?.(error)
      },
      on(event, handler) {
        if (event === 'error') {
          errorHandler = handler
        }
        return this
      },
      end() {
        observedOptions.push({ url, rejectUnauthorized: options.rejectUnauthorized })

        if (options.rejectUnauthorized !== false) {
          errorHandler?.(createCertificateExpiredError())
          return
        }

        const page = pagesByUrl.get(url)
        if (!page) {
          errorHandler?.(new Error(`Unexpected TLS bypass URL: ${url}`))
          return
        }

        const response = new EventEmitter()
        response.statusCode = page.status
        response.headers = { 'content-type': page.contentType }
        response.resume = () => {}

        callback(response)
        response.emit('data', Buffer.from(page.html))
        response.emit('end')
      },
    }
  }

test('Storeys Real Estate sentinel pins the verified broken first-party WordPress JSON surface and unavailable API contract', () => {
  assert.equal(SOURCE, 'storeysrealestate')
  assert.equal(COMPANY, 'Storeys Real Estate')
  assert.equal(HOMEPAGE_URL, 'https://www.storeys.ae/')
  assert.equal(CAREERS_URL, 'https://www.storeys.ae/careers')
  assert.equal(CAREERS_API_URL, 'https://api.storeys.ae/api/v1/careers')

  assert.equal(hasBrokenWordPressJsonSignal(brokenWordPressJson(HOMEPAGE_URL)), true)
  assert.equal(hasBrokenWordPressJsonSignal(brokenWordPressJson(CAREERS_URL)), true)
  assert.equal(hasUnavailableCareersApiSignal(unavailableApiPage), true)

  assert.equal(hasRecoverableCertificateError('fetch failed: certificate has expired'), true)
  assert.equal(hasTimeoutError(`timeout for ${CAREERS_API_URL}`), true)
  assert.equal(hasPublicJobsSignal('{"jobs":[{"title":"Senior Agent"}]}'), false)
})

test('Storeys Real Estate unavailable legacy surface cannot prove zero jobs', async () => {
  const requestedUrls = []

  await assert.rejects(createStoreysRealEstateScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return brokenWordPressJson(HOMEPAGE_URL)
      if (url === CAREERS_URL) return brokenWordPressJson(CAREERS_URL)
      if (url === CAREERS_API_URL) return unavailableApiPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  }), (error) => error.code === 'STOREYS_INVENTORY_UNAVAILABLE' && error.abortRetries === true)

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    CAREERS_API_URL,
  ])
})

test('Storeys Real Estate preserves TLS certificate validation failures without retrying insecurely', async () => {
  const originalFetch = globalThis.fetch
  const originalRequest = https.request
  const observedBypassOptions = []
  const tlsBypassPages = new Map([
    [HOMEPAGE_URL, brokenWordPressJson(HOMEPAGE_URL)],
    [CAREERS_URL, brokenWordPressJson(CAREERS_URL)],
  ])

  globalThis.fetch = async (url) => {
    if (url === HOMEPAGE_URL || url === CAREERS_URL) {
      throw createCertificateExpiredError()
    }

    if (url === CAREERS_API_URL) {
      throw new Error(`timeout for ${CAREERS_API_URL}`)
    }

    throw new Error(`Unexpected URL: ${url}`)
  }
  https.request = createMockTlsBypassRequest(tlsBypassPages, observedBypassOptions)

  try {
    await assert.rejects(createStoreysRealEstateScraper().run(), /certificate/i)    assert.deepEqual(observedBypassOptions, [])
  } finally {
    globalThis.fetch = originalFetch
    https.request = originalRequest
  }
})

test('Storeys Real Estate default fetch attaches a bounded abort signal to every request', async () => {
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options })

    if (url === HOMEPAGE_URL) {
      return {
        status: 500,
        url: HOMEPAGE_URL,
        headers: { get: () => 'application/json; charset=UTF-8' },
        text: async () => brokenWordPressJson(HOMEPAGE_URL).html,
      }
    }

    if (url === CAREERS_URL) {
      return {
        status: 500,
        url: CAREERS_URL,
        headers: { get: () => 'application/json; charset=UTF-8' },
        text: async () => brokenWordPressJson(CAREERS_URL).html,
      }
    }

    if (url === CAREERS_API_URL) {
      throw new Error(`timeout for ${CAREERS_API_URL}`)
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  try {
    await assert.rejects(createStoreysRealEstateScraper().run(), error => error.code === 'STOREYS_INVENTORY_UNAVAILABLE')    assert.deepEqual(requests.map((request) => request.url), [
      HOMEPAGE_URL,
      CAREERS_URL,
      CAREERS_API_URL,
    ])
    assert.ok(
      requests.every((request) => request.options.signal && typeof request.options.signal.aborted === 'boolean'),
      'Expected every default fetch request to include an AbortSignal timeout',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Storeys Real Estate sentinel fails closed when the verified broken first-party surface changes or the API starts responding', async () => {
  await assert.rejects(
    createStoreysRealEstateScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            contentType: 'text/html; charset=UTF-8',
            html: '<html><body><h1>Storeys careers recovered</h1></body></html>',
            errorMessage: '',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    createStoreysRealEstateScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return brokenWordPressJson(HOMEPAGE_URL)
        if (url === CAREERS_URL) {
          return {
            status: 500,
            url: CAREERS_URL,
            contentType: 'application/json; charset=UTF-8',
            html: JSON.stringify({
              code: 'internal_server_error',
              message: '<p>Current Openings</p><p><a href="/careers/sales-agent">View openings</a></p>',
              data: { status: 500 },
            }),
            errorMessage: '',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    createStoreysRealEstateScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return brokenWordPressJson(HOMEPAGE_URL)
        if (url === CAREERS_URL) return brokenWordPressJson(CAREERS_URL)
        if (url === CAREERS_API_URL) {
          return {
            status: 200,
            url: CAREERS_API_URL,
            contentType: 'application/json; charset=UTF-8',
            html: JSON.stringify({
              jobs: [
                { title: 'Sales Agent', id: 42 },
              ],
            }),
            errorMessage: '',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers api/i,
  )
})
