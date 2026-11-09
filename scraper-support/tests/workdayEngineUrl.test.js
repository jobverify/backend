import assert from 'node:assert/strict'
import nodeTest from 'node:test'

import {
  buildWorkdayAppliedFacets,
  buildWorkdaySearchUrl,
  extractCity,
  fetchWorkdayJobsApiPage as fetchWorkdayJobsApiPageImpl,
  hasWorkdayOutageSignal,
  inferWorkdayJobsApiConfig,
  matchesWorkdayLocationPattern,
  runWorkdayScraper as runWorkdayScraperImpl,
  shouldFetchWorkdayJobDetail,
  shouldContinueWorkdayJobsApiPagination,
  WorkdayHostCircuitBreaker,
  WorkdayUpstreamOutageError,
} from '../myworkday/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Parser/deadline fixtures isolate pacing, which has its own integration tests.
const requestScheduler = { acquire: async () => () => {}, recordRateLimit: () => {} }
const fetchWorkdayJobsApiPage = (options) => fetchWorkdayJobsApiPageImpl({ requestScheduler, ...options })
const runWorkdayScraper = (options) => runWorkdayScraperImpl({ requestScheduler, ...options })

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const test = (name, fn) => nodeTest(name, { concurrency: false }, fn)

class FakeDomElement {
  constructor({
    tagName = 'div',
    attributes = {},
    innerText = '',
    href = '',
    children = [],
  } = {}) {
    this.tagName = tagName.toLowerCase()
    this.attributes = { ...attributes }
    this.innerText = innerText
    this.href = href
    this.parentElement = null
    this.children = []

    for (const child of children) {
      this.appendChild(child)
    }
  }

  appendChild(child) {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null
  }

  contains(node) {
    let current = node
    while (current) {
      if (current === this) return true
      current = current.parentElement
    }

    return false
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null
  }

  querySelectorAll(selector) {
    const selectorParts = selector
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    const matchesSimpleSelector = (node, simpleSelector) => {
      if (!simpleSelector) return false
      if (simpleSelector.startsWith('[')) {
        const match = simpleSelector.match(/^\[([^=\]]+)="([^"]+)"\]$/)
        return match ? node.getAttribute(match[1]) === match[2] : false
      }

      return node.tagName === simpleSelector.toLowerCase()
    }
    const matchesSelector = (node, selectorText) => {
      const segments = selectorText.split(/\s+/).filter(Boolean)
      if (!segments.length) return false
      if (!matchesSimpleSelector(node, segments.at(-1))) return false

      let current = node.parentElement
      for (let index = segments.length - 2; index >= 0; index -= 1) {
        const segment = segments[index]
        while (current && !matchesSimpleSelector(current, segment)) {
          current = current.parentElement
        }

        if (!current) return false
        current = current.parentElement
      }

      return true
    }

    const results = []
    const visit = (node) => {
      for (const child of node.children) {
        if (selectorParts.some((part) => matchesSelector(child, part))) {
          results.push(child)
        }

        visit(child)
      }
    }

    visit(this)
    return results
  }

  closest(selector) {
    const selectorParts = selector
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    let current = this

    while (current) {
      if (selectorParts.some((part) => current.matches(part))) {
        return current
      }

      current = current.parentElement
    }

    return null
  }

  matches(selector) {
    if (!selector) return false
    if (selector.startsWith('[')) {
      const match = selector.match(/^\[([^=\]]+)="([^"]+)"\]$/)
      return match ? this.getAttribute(match[1]) === match[2] : false
    }

    return this.tagName === selector.toLowerCase()
  }
}

test('inferWorkdayJobsApiConfig derives public API and detail URLs from Workday boards', () => {
  assert.deepEqual(
    inferWorkdayJobsApiConfig('https://att.wd1.myworkdayjobs.com/ATTSpecialInvite'),
    {
      jobsApiUrl: 'https://att.wd1.myworkdayjobs.com/wday/cxs/att/ATTSpecialInvite/jobs',
      detailUrlBase: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite',
    },
  )

  assert.deepEqual(
    inferWorkdayJobsApiConfig('https://shell.wd3.myworkdayjobs.com/en-GB/shellcareers'),
    {
      jobsApiUrl: 'https://shell.wd3.myworkdayjobs.com/wday/cxs/shell/shellcareers/jobs',
      detailUrlBase: 'https://shell.wd3.myworkdayjobs.com/en-GB/shellcareers',
    },
  )

  assert.deepEqual(
    inferWorkdayJobsApiConfig('https://elemica.wd501.myworkdayjobs.com/wday/cxs/elemica/Elemica_Careers/jobs'),
    {
      jobsApiUrl: 'https://elemica.wd501.myworkdayjobs.com/wday/cxs/elemica/Elemica_Careers/jobs',
      detailUrlBase: 'https://elemica.wd501.myworkdayjobs.com/Elemica_Careers',
    },
  )

  assert.equal(inferWorkdayJobsApiConfig('https://example.com/careers'), null)
})

test('buildWorkdaySearchUrl appends the India locationCountry filter when the base URL has no query', () => {
  assert.equal(
    buildWorkdaySearchUrl(
      'https://example.wd5.myworkdayjobs.com/en-US/External',
      'c4f78be1a8f14da0ab49ce1162348a5e',
    ),
    'https://example.wd5.myworkdayjobs.com/en-US/External?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
})

test('buildWorkdaySearchUrl appends the India locationCountry filter when the base URL already has other query params', () => {
  assert.equal(
    buildWorkdaySearchUrl(
      'https://example.wd5.myworkdayjobs.com/en-US/External?locations=abc123',
      'c4f78be1a8f14da0ab49ce1162348a5e',
    ),
    'https://example.wd5.myworkdayjobs.com/en-US/External?locations=abc123&locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
})

test('buildWorkdaySearchUrl preserves prefiltered country queries from official career pages', () => {
  const existing = 'https://sec.wd3.myworkdayjobs.com/en-US/Samsung_Careers?locations=189767dd6c9201b802603c83a5292c78&Location_Country=c4f78be1a8f14da0ab49ce1162348a5e&hiringCompany=189767dd6c9201554f3e5312a7290a85'

  assert.equal(
    buildWorkdaySearchUrl(existing, 'c4f78be1a8f14da0ab49ce1162348a5e'),
    existing,
  )
})

test('buildWorkdaySearchUrl can skip the default country query for boards that reject the generic India facet', () => {
  assert.equal(
    buildWorkdaySearchUrl(
      'https://marvell.wd1.myworkdayjobs.com/en-US/MarvellCareers',
      null,
    ),
    'https://marvell.wd1.myworkdayjobs.com/en-US/MarvellCareers',
  )
})

test('buildWorkdayAppliedFacets maps the default India filter to the lowercase Workday country facet', () => {
  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://cadence.wd1.myworkdayjobs.com/External_Careers',
      'c4f78be1a8f14da0ab49ce1162348a5e',
    ),
    {
      locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
    },
  )
})

test('buildWorkdayAppliedFacets preserves existing Workday facet params from prefiltered career pages without rewriting Location_Country', () => {
  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://sec.wd3.myworkdayjobs.com/en-US/Samsung_Careers?locations=189767dd6c9201b802603c83a5292c78&Location_Country=c4f78be1a8f14da0ab49ce1162348a5e&hiringCompany=189767dd6c9201554f3e5312a7290a85',
      'c4f78be1a8f14da0ab49ce1162348a5e',
    ),
    {
      locations: ['189767dd6c9201b802603c83a5292c78'],
      Location_Country: ['c4f78be1a8f14da0ab49ce1162348a5e'],
      hiringCompany: ['189767dd6c9201554f3e5312a7290a85'],
    },
  )
})

test('buildWorkdayAppliedFacets can omit the default country facet for boards that need post-filtering instead', () => {
  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://marvell.wd1.myworkdayjobs.com/en-US/MarvellCareers',
      null,
    ),
    {},
  )
})

test('extractCity prefers the city segment for country-first Workday locations and normalizes virtual India jobs as remote', () => {
  assert.equal(extractCity('India, Bangalore'), 'Bangalore')
  assert.equal(extractCity('Virtual India'), 'Remote')
})

test('extractCity ignores leading country codes in comma-separated Workday locations', () => {
  assert.equal(extractCity('IND, Bangalore, KA'), 'Bangalore')
})

test('extractCity prefers the canonical city over campus labels in India locations', () => {
  assert.equal(extractCity('Phoenix Building, Bangalore, India'), 'Bangalore')
})

test('matchesWorkdayLocationPattern can enforce India-only results when Workday query params are insufficient', () => {
  assert.equal(
    matchesWorkdayLocationPattern(
      {
        location: '2 Locations',
        locations: ['Bengaluru, India', 'Mumbai, India'],
      },
      'india|bengaluru|bangalore|mumbai',
    ),
    true,
  )

  assert.equal(
    matchesWorkdayLocationPattern(
      {
        location: 'USA - Remote',
        locations: [],
      },
      'india|bengaluru|bangalore|mumbai',
    ),
    false,
  )
})

test('shouldContinueWorkdayJobsApiPagination keeps paging when Workday returns a full page but zero total on later offsets', () => {
  assert.equal(
    shouldContinueWorkdayJobsApiPagination({
      jobsCount: 20,
      offsetAfterPage: 40,
      payloadTotal: 0,
      pageSize: 20,
    }),
    true,
  )
})

test('shouldContinueWorkdayJobsApiPagination stops when Workday returns a short final page', () => {
  assert.equal(
    shouldContinueWorkdayJobsApiPagination({
      jobsCount: 4,
      offsetAfterPage: 84,
      payloadTotal: 0,
      pageSize: 20,
    }),
    false,
  )
})

test('shouldFetchWorkdayJobDetail skips obvious non-matching summary locations but keeps grouped labels for detail inspection', () => {
  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: 'Santa Clara, CA' },
      'india|bengaluru|bangalore|pune|hyderabad',
    ),
    false,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: 'Bangalore' },
      'india|bengaluru|bangalore|pune|hyderabad',
    ),
    true,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: '2 Locations' },
      'india|bengaluru|bangalore|pune|hyderabad',
    ),
    true,
  )
})

test('shouldFetchWorkdayJobDetail skips clearly non-India summary locations even without a custom location pattern', () => {
  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: 'Remote, North Carolina, United States of America' },
    ),
    false,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: 'Madrid, Spain' },
    ),
    false,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: 'Bangalore Area' },
    ),
    true,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail(
      { location: 'Ind – Blr Sez 1 (3Rd, 6Th & 7Th Floor)' },
    ),
    true,
  )
})

test('fetchWorkdayJobsApiPage retries a transient HTTP 503 once before succeeding', async () => {
  const originalFetch = global.fetch
  let attempts = 0

  global.fetch = async () => {
    attempts += 1
    if (attempts === 1) {
      return {
        ok: false,
        status: 503,
        url: 'https://retry-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
        headers: {
          get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        text: async () => JSON.stringify({
          errorCode: 'HTTP_503',
          httpStatus: 503,
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      url: 'https://retry-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
      headers: {
        get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        total: 1,
        jobPostings: [{ title: 'Recovered request' }],
      }),
    }
  }

  try {
    const payload = await fetchWorkdayJobsApiPage({
      jobsApiUrl: 'https://retry-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
      appliedFacets: { Location_Country: ['india-id'] },
      offset: 0,
      limit: 20,
      searchText: '',
      session: {},
      retryBaseDelayMs: 0,
    })

    assert.equal(attempts, 2)
    assert.equal(payload.total, 1)
    assert.equal(payload.jobPostings[0].title, 'Recovered request')
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage aborts a hung request at the request deadline without retrying', async () => {
  const originalFetch = global.fetch
  let attempts = 0

  global.fetch = async (_url, options = {}) => {
    attempts += 1
    return new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        reject(options.signal.reason)
      }, { once: true })
    })
  }

  try {
    await assert.rejects(
      Promise.race([
        fetchWorkdayJobsApiPage({
          jobsApiUrl: 'https://request-timeout-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
          appliedFacets: { Location_Country: ['india-id'] },
          offset: 0,
          source: 'request-timeout-test',
          session: {},
          requestTimeoutMs: 10,
          retryBaseDelayMs: 0,
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('request deadline was not enforced')), 100)
        }),
      ]),
      (error) => {
        assert.equal(error.name, 'WorkdayRequestTimeoutError')
        assert.equal(error.abortRetries, true)
        assert.equal(error.softFailure, true)
        assert.notEqual(error.localTimeout, true)
        return true
      },
    )
    assert.equal(attempts, 1)
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage keeps the request deadline active while reading the response body', async () => {
  const originalFetch = global.fetch
  let requestSignal

  global.fetch = async (_url, options = {}) => {
    requestSignal = options.signal
    return {
      ok: true,
      status: 200,
      url: 'https://body-timeout-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
      headers: { get: () => 'application/json' },
      json: async () => new Promise((resolve, reject) => {
        requestSignal?.addEventListener('abort', () => {
          reject(requestSignal.reason)
        }, { once: true })
      }),
    }
  }

  try {
    await assert.rejects(
      Promise.race([
        fetchWorkdayJobsApiPage({
          jobsApiUrl: 'https://body-timeout-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
          appliedFacets: { Location_Country: ['india-id'] },
          offset: 0,
          source: 'body-timeout-test',
          session: {},
          requestTimeoutMs: 10,
          retryBaseDelayMs: 0,
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('response body deadline was not enforced')), 100)
        }),
      ]),
      (error) => error.name === 'WorkdayRequestTimeoutError',
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage propagates caller cancellation into the active request', async () => {
  const originalFetch = global.fetch
  const controller = new AbortController()
  const abortReason = new Error('source budget expired')

  global.fetch = async (_url, options = {}) => new Promise((resolve, reject) => {
    options.signal?.addEventListener('abort', () => {
      reject(options.signal.reason)
    }, { once: true })
  })

  try {
    const request = fetchWorkdayJobsApiPage({
      jobsApiUrl: 'https://caller-abort-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
      appliedFacets: { Location_Country: ['india-id'] },
      offset: 0,
      source: 'caller-abort-test',
      session: {},
      signal: controller.signal,
      requestTimeoutMs: 1000,
      retryBaseDelayMs: 0,
    })
    setTimeout(() => controller.abort(abortReason), 5)

    await assert.rejects(
      Promise.race([
        request,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('caller cancellation was not propagated')), 100)
        }),
      ]),
      (error) => error === abortReason,
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage opens a host circuit after repeated transient failures', async () => {
  const originalFetch = global.fetch
  let attempts = 0
  const circuitBreaker = new WorkdayHostCircuitBreaker()
  const request = {
    jobsApiUrl: 'https://circuit-breaker-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
    appliedFacets: { Location_Country: ['india-id'] },
    offset: 0,
    source: 'circuit-breaker-test',
    session: {},
    retryBaseDelayMs: 0,
    circuitBreaker,
  }

  global.fetch = async (url) => {
    attempts += 1
    return {
      ok: false,
      status: 503,
      url,
      headers: {
        get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      text: async () => JSON.stringify({
        errorCode: 'HTTP_503',
        httpStatus: 503,
      }),
    }
  }

  try {
    await assert.rejects(
      fetchWorkdayJobsApiPage(request),
      (error) => {
        assert.match(error.message, /HTTP_503/)
        assert.equal(error.softFailure, true)
        assert.equal(error.abortRetries, true)
        return true
      },
    )
    assert.equal(attempts, 2)

    await assert.rejects(
      fetchWorkdayJobsApiPage(request),
      (error) => {
        assert.equal(error.name, 'WorkdayHostCircuitOpenError')
        assert.equal(error.abortRetries, true)
        return true
      },
    )
    assert.equal(attempts, 2)
  } finally {
    global.fetch = originalFetch
  }
})

test('WorkdayHostCircuitBreaker isolates hosts, resets on success, and recovers after cooldown', () => {
  let now = 1_000
  const circuitBreaker = new WorkdayHostCircuitBreaker({
    failureThreshold: 2,
    cooldownMs: 500,
    now: () => now,
  })
  const failingUrl = 'https://failing.wd5.myworkdayjobs.com/wday/cxs/test/jobs'
  const healthyUrl = 'https://healthy.wd5.myworkdayjobs.com/wday/cxs/test/jobs'
  const transientError = new Error('HTTP 503')
  transientError.jobsApiHttpStatus = 503

  circuitBreaker.recordFailure(failingUrl, transientError)
  assert.doesNotThrow(() => circuitBreaker.assertRequestAllowed(failingUrl, 'failing'))
  circuitBreaker.recordFailure(failingUrl, transientError)

  assert.throws(
    () => circuitBreaker.assertRequestAllowed(failingUrl, 'failing'),
    (error) => error.name === 'WorkdayHostCircuitOpenError',
  )
  assert.doesNotThrow(() => circuitBreaker.assertRequestAllowed(healthyUrl, 'healthy'))

  now += 500
  assert.doesNotThrow(() => circuitBreaker.assertRequestAllowed(failingUrl, 'failing'))

  circuitBreaker.recordFailure(failingUrl, transientError)
  circuitBreaker.recordSuccess(failingUrl)
  assert.doesNotThrow(() => circuitBreaker.assertRequestAllowed(failingUrl, 'failing'))
})

test('successful session bootstrap does not reset accumulated jobs API transport failures', async () => {
  const originalFetch = global.fetch
  let fetchCalls = 0
  const circuitBreaker = new WorkdayHostCircuitBreaker({
    failureThreshold: 3,
    cooldownMs: 60_000,
  })
  const request = {
    jobsApiUrl: 'https://bootstrap-circuit-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
    bootstrapUrl: 'https://bootstrap-circuit-test.wd5.myworkdayjobs.com/en-US/external',
    appliedFacets: { Location_Country: ['india-id'] },
    offset: 0,
    source: 'bootstrap-circuit-test',
    retryBaseDelayMs: 0,
    circuitBreaker,
  }

  global.fetch = async (url, options = {}) => {
    fetchCalls += 1
    if ((options.method || 'GET') === 'GET') {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html',
          getSetCookie: () => [],
        },
        text: async () => '<html><body>Workday careers</body></html>',
      }
    }
    throw new TypeError('transport failed')
  }

  try {
    await assert.rejects(fetchWorkdayJobsApiPage(request), /transport failed/)
    await assert.rejects(fetchWorkdayJobsApiPage(request), /transport failed|circuit is open/i)
    await assert.rejects(fetchWorkdayJobsApiPage(request), /transport failed|circuit is open/i)
    const callsBeforeBlockedRequest = fetchCalls
    await assert.rejects(
      fetchWorkdayJobsApiPage(request),
      (error) => error.name === 'WorkdayHostCircuitOpenError',
    )
    assert.equal(fetchCalls, callsBeforeBlockedRequest)
    assert.equal(fetchCalls, 6)
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage can bootstrap a Workday session before posting to jobs endpoints that require cookies and csrf', async () => {
  const originalFetch = global.fetch
  const calls = []

  global.fetch = async (url, options = {}) => {
    calls.push({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || null,
    })

    if (calls.length === 1) {
      assert.equal(options.method ?? 'GET', 'GET')
      assert.equal(
        url,
        'https://abb.wd3.myworkdayjobs.com/External_Career_Page?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
      )

      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => ([
            'PLAY_SESSION=session-cookie; Path=/; Secure; HttpOnly',
            'CALYPSO_CSRF_TOKEN=csrf-cookie-token; Path=/; Secure',
          ]),
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Workday shell</body></html>',
      }
    }

    assert.equal(url, 'https://abb.wd3.myworkdayjobs.com/wday/cxs/abb/External_Career_Page/jobs')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.accept, 'application/json')
    assert.equal(options.headers['content-type'], 'application/json')
    assert.equal(options.headers['x-calypso-csrf-token'], 'csrf-cookie-token')
    assert.match(options.headers.cookie, /PLAY_SESSION=session-cookie/)
    assert.match(options.headers.cookie, /CALYPSO_CSRF_TOKEN=csrf-cookie-token/)
    assert.equal(
      options.headers.referer,
      'https://abb.wd3.myworkdayjobs.com/External_Career_Page?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
    )
    assert.equal(options.headers.origin, 'https://abb.wd3.myworkdayjobs.com')

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        total: 1,
        jobPostings: [{ title: 'Accounting and Reporting Analyst' }],
      }),
    }
  }

  try {
    const payload = await fetchWorkdayJobsApiPage({
      jobsApiUrl: 'https://abb.wd3.myworkdayjobs.com/wday/cxs/abb/External_Career_Page/jobs',
      bootstrapUrl: 'https://abb.wd3.myworkdayjobs.com/External_Career_Page?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
      appliedFacets: { locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'] },
      offset: 0,
      limit: 20,
      searchText: '',
      source: 'abb',
    })

    assert.equal(calls.length, 2)
    assert.equal(payload.total, 1)
    assert.equal(payload.jobPostings[0].title, 'Accounting and Reporting Analyst')
  } finally {
    global.fetch = originalFetch
  }
})

test('hasWorkdayOutageSignal detects Workday outage markers from titles, html, and redirect URLs', () => {
  assert.equal(
    hasWorkdayOutageSignal({
      title: 'Workday is currently unavailable.',
    }),
    true,
  )

  assert.equal(
    hasWorkdayOutageSignal({
      html: '<html><body><a href="https://community.workday.com/maintenance-page?d=5&s=1&e=1&o=">Maintenance</a></body></html>',
    }),
    true,
  )

  assert.equal(
    hasWorkdayOutageSignal({
      responseUrls: ['https://wd5.myworkday.com/wday/drs/outage?t=cloudera&s=External_Career'],
    }),
    true,
  )

  assert.equal(
    hasWorkdayOutageSignal({
      title: 'Careers | Example Corp',
      html: '<html><body><ul role="list"></ul></body></html>',
    }),
    false,
  )
})

test('hasWorkdayOutageSignal does not treat the normal Workday shell maintenancePageUrl config as an outage by itself', () => {
  assert.equal(
    hasWorkdayOutageSignal({
      html: `
        <script>
          window.__APP_CONFIG__ = {
            maintenancePageUrl: "https://wd3.myworkday.com/wday/drs/outage?t=abb&s=External_Career_Page",
            appName: "cxs"
          };
        </script>
      `,
    }),
    false,
  )
})

test('fetchWorkdayJobsApiPage throws a WorkdayUpstreamOutageError when Workday returns an outage html page', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://example.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=UTF-8' : null),
    },
    text: async () => '<html><head><title>Workday is currently unavailable.</title></head><body>maintenance-page</body></html>',
  })

  try {
    await assert.rejects(
      fetchWorkdayJobsApiPage({
        jobsApiUrl: 'https://example.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
        appliedFacets: { Location_Country: ['india-id'] },
        offset: 0,
        limit: 20,
        searchText: '',
        source: 'example',
      }),
      (error) => {
        assert.equal(error instanceof WorkdayUpstreamOutageError, true)
        assert.equal(error.softFailure, true)
        assert.match(error.message, /\[example\] Workday is currently unavailable upstream/i)
        return true
      },
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage surfaces Workday JSON API HTTP 400 failures without marking them as upstream outages', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => ({
    ok: false,
    status: 400,
    url: 'https://example.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json;charset=ISO-8859-1' : null),
    },
    text: async () => JSON.stringify({
      errorCode: 'HTTP_400',
      errorCaseId: 'E8ED33MRRIIQ0J',
      httpStatus: 400,
      locale: '*',
      message: '',
      messageParams: {},
    }),
  })

  try {
    await assert.rejects(
      fetchWorkdayJobsApiPage({
        jobsApiUrl: 'https://example.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
        appliedFacets: { Location_Country: ['india-id'] },
        offset: 0,
        limit: 20,
        searchText: '',
        source: 'example',
      }),
      (error) => {
        assert.equal(error instanceof WorkdayUpstreamOutageError, false)
        assert.notEqual(error.softFailure, true)
        assert.equal(error.abortRetries, true)
        assert.match(error.message, /\[example\] Workday jobs API returned HTTP_400/i)
        return true
      },
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage rejects malformed or internally inconsistent success payloads', async () => {
  const originalFetch = global.fetch
  const payloads = [
    {},
    { total: 10, jobPostings: [] },
  ]
  let payloadIndex = 0

  global.fetch = async (url) => ({
    ok: true,
    status: 200,
    url,
    headers: { get: () => 'application/json' },
    json: async () => payloads[payloadIndex++],
  })

  try {
    for (let index = 0; index < payloads.length; index += 1) {
      await assert.rejects(
        fetchWorkdayJobsApiPage({
          jobsApiUrl: 'https://contract-test.wd5.myworkdayjobs.com/wday/cxs/example/external/jobs',
          appliedFacets: { Location_Country: ['india-id'] },
          offset: 0,
          source: 'contract-test',
          session: {},
        }),
        (error) => {
          assert.equal(error.name, 'WorkdayJobsApiContractError')
          assert.equal(error.abortRetries, true)
          return true
        },
      )
    }
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper jobs-api mode does not require Puppeteer when the first API page has no jobs', async () => {
  const originalFetch = global.fetch
  const calls = []

  global.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })

    if (calls.length === 1) {
      assert.equal(url, 'https://target.wd5.myworkdayjobs.com/en-US/targetcareers')
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Target Workday shell</body></html>',
      }
    }

    assert.equal(url, 'https://target.wd5.myworkdayjobs.com/wday/cxs/target/targetcareers/jobs')
    assert.equal(options.method, 'POST')
    return {
      ok: true,
      status: 200,
      url,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        total: 0,
        jobPostings: [],
      }),
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Target',
      baseUrl: 'https://target.wd5.myworkdayjobs.com/en-US/targetcareers',
      locationCountry: null,
      source: 'target',
      scraperDir: path.join(testsDir, '../../scraper/target.workday'),
    })

    assert.deepEqual(jobs, [])
    assert.equal(
      readInventoryEvidence(jobs)?.status,
      'unverified',
    )
    assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST'])
  } finally {
    global.fetch = originalFetch
  }
})

test('nonempty Workday payloads that produce no valid jobs are not marked authoritative empty', async () => {
  const originalFetch = global.fetch

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET') {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html',
        },
        text: async () => '<html><body>Workday careers</body></html>',
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => 'application/json' },
      json: async () => ({
        total: 1,
        jobPostings: [{
          title: 'Schema-drifted posting without an external path',
          locationsText: 'Bengaluru, India',
        }],
      }),
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Contract Test',
      baseUrl: 'https://nonempty-contract-test.wd5.myworkdayjobs.com/en-US/external',
      locationCountry: 'india-id',
      source: 'nonempty-contract-test',
      scraperDir: path.join(testsDir, '../myworkday'),
    })

    assert.deepEqual(jobs, [])
    assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper uses bulletFields and externalPath to recover India summary locations when locationsText is missing', async () => {
  const originalFetch = global.fetch

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET' && !url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html',
        },
        text: async () => '<html><body>Cadence careers</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => ({
          total: 1,
          jobPostings: [{
            title: 'Contract Associate Manager',
            externalPath: '/job/Bengaluru/Contract-Associate-Manager_R00342826',
            postedOn: 'Posted Today',
            bulletFields: ['R00342826', 'Bengaluru'],
          }],
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => 'text/html' },
      text: async () => '<html><body><h1>Contract Associate Manager</h1></body></html>',
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Cadence',
      baseUrl: 'https://cadence.wd1.myworkdayjobs.com/en-US/External_Careers',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'cadence',
      scraperDir: path.join(testsDir, '../../scraper/cadence.workday'),
      launchBrowserImpl: async () => {
        throw new Error('DOM browser must not launch when the jobs API works')
      },
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].location, 'Bengaluru')
    assert.equal(jobs[0].city, 'Bangalore')
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper prefers an inferred public jobs API before launching a DOM browser', async () => {
  const originalFetch = global.fetch
  const calls = []
  let browserLaunches = 0

  global.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    if (calls.length === 1) {
      assert.equal(
        url,
        'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
      )
      return {
        ok: true,
        status: 200,
        url,
        headers: { getSetCookie: () => [], get: () => 'text/html' },
        text: async () => '<html><body>AT&T Workday shell</body></html>',
      }
    }

    assert.equal(
      url,
      'https://att.wd1.myworkdayjobs.com/wday/cxs/att/ATTSpecialInvite/jobs',
    )
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => 'application/json' },
      json: async () => ({ total: 0, jobPostings: [] }),
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'AT&T',
      baseUrl: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'att',
      scraperDir: path.join(testsDir, '../../scraper/att.workday'),
      launchBrowserImpl: async () => {
        browserLaunches += 1
        throw new Error('DOM browser must not launch when the inferred API works')
      },
    })

    assert.deepEqual(jobs, [])
    assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST'])
    assert.equal(browserLaunches, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper fails closed without launching a browser when no jobs API can be configured', async () => {
  let browserLaunches = 0

  await assert.rejects(
    runWorkdayScraper({
      company: 'Example',
      baseUrl: 'https://careers.example.com/jobs',
      locationCountry: null,
      source: 'example-api-only',
      scraperDir: path.join(testsDir, '../myworkday'),
      launchBrowserImpl: async () => {
        browserLaunches += 1
        throw new Error('browser launch must remain unreachable')
      },
    }),
    (error) => {
      assert.equal(error.abortRetries, true)
      assert.match(error.message, /could not infer a public Workday jobs API/i)
      return true
    },
  )

  assert.equal(browserLaunches, 0)
})

test('runWorkdayScraper fails closed without launching a browser for Workday API HTTP errors', async (t) => {
  const originalFetch = global.fetch

  try {
    for (const status of [400, 403, 404, 429, 503]) {
      await t.test(`HTTP ${status}`, async () => {
        let browserLaunches = 0

        global.fetch = async (url, options = {}) => {
          if ((options.method || 'GET') === 'GET') {
            return {
              ok: true,
              status: 200,
              url,
              headers: {
                getSetCookie: () => [],
                get: () => 'text/html; charset=UTF-8',
              },
              text: async () => '<html><body>Workday shell</body></html>',
            }
          }

          return {
            ok: false,
            status,
            url,
            headers: { get: () => 'application/json;charset=UTF-8' },
            text: async () => JSON.stringify({
              errorCode: `HTTP_${status}`,
              httpStatus: status,
            }),
          }
        }

        await assert.rejects(
          runWorkdayScraper({
            company: 'API Failure Test',
            baseUrl: 'https://api-failure-test.wd5.myworkdayjobs.com/External',
            locationCountry: 'india-id',
            source: `api-failure-${status}`,
            scraperDir: path.join(testsDir, '../myworkday'),
            retryBaseDelayMs: 0,
            circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
            detailCircuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
            launchBrowserImpl: async () => {
              browserLaunches += 1
              throw new Error('browser launch must remain unreachable')
            },
          }),
          (error) => {
            assert.equal(error.name, 'WorkdayJobsApiError')
            assert.equal(error.jobsApiHttpStatus, status)
            assert.equal(error.abortRetries, true)
            return true
          },
        )

        assert.equal(browserLaunches, 0)
      })
    }
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper bootstraps jobs-api mode from detailUrlBase when baseUrl is already an API endpoint', async () => {
  const originalFetch = global.fetch
  const calls = []

  global.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    if (calls.length === 1) {
      assert.equal(
        url,
        'https://elemica.wd501.myworkdayjobs.com/en-US/Elemica_Careers?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
      )
      return {
        ok: true,
        status: 200,
        url,
        headers: { getSetCookie: () => [], get: () => 'text/html' },
        text: async () => '<html><body>Elemica Workday shell</body></html>',
      }
    }

    assert.equal(
      url,
      'https://elemica.wd501.myworkdayjobs.com/wday/cxs/elemica/Elemica_Careers/jobs',
    )
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => 'application/json' },
      json: async () => ({ total: 0, jobPostings: [] }),
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Elemica',
      baseUrl: 'https://elemica.wd501.myworkdayjobs.com/wday/cxs/elemica/Elemica_Careers/jobs',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'elemica',
      scraperDir: path.join(testsDir, '../../scraper/elemica.workday'),
    })
    assert.deepEqual(jobs, [])
    assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST'])
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper jobs-api mode fetches detail HTML without requiring Puppeteer', async () => {
  const originalFetch = global.fetch
  const calls = []
  const detailUrl = 'https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/Bangalore-Karnataka-India/Engineer_R123'

  global.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })

    if (calls.length === 1) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => ['PLAY_SESSION=session-cookie; Path=/; Secure; HttpOnly'],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Target Workday shell</body></html>',
      }
    }

    if (calls.length === 2) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          total: 1,
          jobPostings: [{
            title: 'Engineer',
            externalPath: '/job/Bangalore-Karnataka-India/Engineer_R123',
            locationsText: 'Bangalore, India',
            postedOn: 'Today',
          }],
        }),
      }
    }

    assert.equal(url, detailUrl)
    assert.match(options.headers.cookie, /PLAY_SESSION=session-cookie/)
    return {
      ok: true,
      status: 200,
      url,
      headers: {
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => `
        <html>
          <body>
            <script type="application/ld+json">
              {
                "@type": "JobPosting",
                "description": "Job Description: Build useful systems. Basic Qualifications: 3 years of engineering experience.",
                "identifier": { "value": "R123" }
              }
            </script>
          </body>
        </html>
      `,
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Target',
      baseUrl: 'https://target.wd5.myworkdayjobs.com/en-US/targetcareers',
      locationCountry: null,
      source: 'target',
      scraperDir: path.join(testsDir, '../../scraper/target.workday'),
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Engineer')
    assert.equal(jobs[0].link, detailUrl)
    assert.equal(jobs[0].city, 'Bangalore')
    assert.equal(jobs[0].requisitionId, 'R123')
    // This fixture has no structured JSON endpoint, so the API attempt uses HTML fallback.
    assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST', 'GET', 'GET'])
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper keeps a listing-backed job when a detail request times out but the summary location is clearly in scope', async () => {
  const originalFetch = global.fetch
  let browserLaunches = 0

  global.fetch = async (url, options = {}) => {
    if (url.includes('/job/')) {
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(options.signal.reason)
        }, { once: true })
      })
    }

    if ((options.method || 'GET') === 'POST') {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => ({
          total: 1,
          jobPostings: [{
            title: 'Engineer',
            externalPath: '/job/Bangalore-India/Engineer_R123',
            locationsText: 'Bangalore, India',
            postedOn: 'Today',
          }],
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        getSetCookie: () => [],
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => '<html><body>Workday shell</body></html>',
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Detail Timeout Test',
      baseUrl: 'https://detail-timeout-test.wd5.myworkdayjobs.com/External',
      locationCountry: 'india-id',
      source: 'detail-timeout-test',
      scraperDir: path.join(testsDir, '../myworkday'),
      requestTimeoutMs: 10,
      retryBaseDelayMs: 0,
      launchBrowserImpl: async () => {
        browserLaunches += 1
        return { close: async () => {} }
      },
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Engineer')
    assert.equal(jobs[0].location, 'Bangalore, India')
    assert.equal(jobs[0].city, 'Bangalore')
    assert.equal(jobs[0].requisitionId, null)
    assert.equal(browserLaunches, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper keeps processing jobs when one detail request hits a transient upstream failure', async () => {
  const originalFetch = global.fetch
  const detailStarts = []
  let releaseActiveDetails
  const activeDetailsReleased = new Promise((resolve) => {
    releaseActiveDetails = resolve
  })

  global.fetch = async (url, options = {}) => {
    if (url.includes('/job/')) {
      detailStarts.push(url)
      if (url.includes('Engineer_R1')) {
        return {
          ok: false,
          status: 503,
          url,
          headers: { get: () => 'text/html' },
          text: async () => 'temporarily unavailable',
        }
      }

      await activeDetailsReleased
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'text/html' },
        text: async () => '<html><body>Engineering role</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => ({
          total: 6,
          jobPostings: Array.from({ length: 6 }, (_, index) => ({
            title: `Engineer ${index + 1}`,
            externalPath: `/job/Bangalore-India/Engineer_R${index + 1}`,
            locationsText: 'Bangalore, India',
            postedOn: 'Today',
          })),
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        getSetCookie: () => [],
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => '<html><body>Workday shell</body></html>',
    }
  }

  setTimeout(releaseActiveDetails, 20)

  try {
    const jobs = await runWorkdayScraper({
      company: 'Detail Failure Test',
      baseUrl: 'https://detail-failure-test.wd5.myworkdayjobs.com/External',
      locationCountry: 'india-id',
      source: 'detail-failure-test',
      scraperDir: path.join(testsDir, '../myworkday'),
      requestTimeoutMs: 1000,
      retryBaseDelayMs: 0,
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(detailStarts.filter(url => url.includes('/wday/cxs/')).length, 6)
    assert.equal(detailStarts.filter(url => !url.includes('/wday/cxs/')).length, 5)
    assert.equal(detailStarts.filter(url => url.includes('Engineer_R1')).length, 1)
    assert.equal(jobs.length, 6)
    assert.equal(jobs[0].title, 'Engineer 1')
    assert.equal(jobs[0].location, 'Bangalore, India')
    assert.equal(jobs[0].requisitionId, null)
    assert.equal(jobs[1].title, 'Engineer 2')
  } finally {
    releaseActiveDetails()
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper jobs-api mode keeps paginating after repeated detail 429s open the detail circuit', async () => {
  const originalFetch = global.fetch
  let postCalls = 0

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET') {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Workday shell</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      postCalls += 1

      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => (
          postCalls === 1
            ? {
                total: 21,
                jobPostings: Array.from({ length: 20 }, (_, index) => ({
                  title: `Engineer ${index + 1}`,
                  externalPath: `/job/Bangalore-India/Engineer_R${index + 1}`,
                  locationsText: 'Bangalore, India',
                  postedOn: 'Today',
                })),
              }
            : {
                total: 21,
                jobPostings: [
                  {
                    title: 'Engineer 21',
                    externalPath: '/job/Chennai-India/Engineer_R21',
                    locationsText: 'Chennai, India',
                    postedOn: 'Today',
                  },
                ],
              }
        ),
      }
    }

    if (url.includes('Engineer_R1') || url.includes('Engineer_R2')) {
      return {
        ok: false,
        status: 429,
        url,
        headers: { get: () => 'text/html; charset=UTF-8' },
        text: async () => 'rate limited',
      }
    }

    if (url.includes('Engineer_R21')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'text/html; charset=UTF-8' },
        text: async () => `
          <html>
            <body>
              <script type="application/ld+json">
                {
                  "@type": "JobPosting",
                  "description": "Job Description: Build useful systems.",
                  "identifier": { "value": "R3" }
                }
              </script>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Detail Circuit Test',
      baseUrl: 'https://detail-circuit-test.wd5.myworkdayjobs.com/External',
      locationCountry: 'india-id',
      source: 'detail-circuit-test',
      scraperDir: path.join(testsDir, '../myworkday'),
      requestTimeoutMs: 1000,
      retryBaseDelayMs: 0,
    })

    assert.equal(postCalls, 2)
    assert.equal(jobs.length, 21)
    assert.equal(jobs[0].title, 'Engineer 1')
    assert.equal(jobs[1].title, 'Engineer 2')
    assert.equal(jobs.at(-1)?.title, 'Engineer 21')
    assert.equal(jobs[0].location, 'Bangalore, India')
    assert.equal(jobs.at(-1)?.city, 'Chennai')
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper jobs-api mode switches to listing-backed jobs after transient detail failures so later pages can still load', async () => {
  const originalFetch = global.fetch
  let postCalls = 0
  const detailCalls = []

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET' && !url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Workday shell</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      postCalls += 1

      if (postCalls === 1) {
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'application/json' },
          json: async () => ({
            total: 21,
            jobPostings: Array.from({ length: 20 }, (_, index) => ({
              title: `Engineer ${index + 1}`,
              externalPath: `/job/Bangalore-India/Engineer_R${index + 1}`,
              locationsText: 'Bangalore, India',
              postedOn: 'Today',
            })),
          }),
        }
      }

      if (detailCalls.length > 1) {
        return {
          ok: false,
          status: 429,
          url,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ errorCode: 'HTTP_429', httpStatus: 429 }),
        }
      }

      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => ({
          total: 21,
          jobPostings: [
            {
              title: 'Engineer 21',
              externalPath: '/job/Chennai-India/Engineer_R21',
              locationsText: 'Chennai, India',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    if (url.includes('/job/')) {
      const requisitionId = url.match(/Engineer_(R\d+)/)?.[1] || 'R?'
      detailCalls.push(requisitionId)

      if (requisitionId === 'R1') {
        return {
          ok: false,
          status: 429,
          url,
          headers: { get: () => 'text/html; charset=UTF-8' },
          text: async () => 'rate limited',
        }
      }

      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'text/html; charset=UTF-8' },
        text: async () => `
          <html>
            <body>
              <h1>Engineer</h1>
              <div>Bangalore, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build useful systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Detail Fallback Test',
      baseUrl: 'https://detail-fallback-test.wd5.myworkdayjobs.com/External',
      locationCountry: 'india-id',
      source: 'detail-fallback-test',
      scraperDir: path.join(testsDir, 'fixtures/workday-detail-fallback-single-concurrency'),
      launchBrowserImpl: async () => {
        throw new Error('DOM browser must not launch when the jobs API can continue with listing-backed jobs')
      },
      requestTimeoutMs: 1000,
      retryBaseDelayMs: 0,
    })

    assert.equal(postCalls, 2)
    assert.deepEqual(detailCalls, ['R1'])
    assert.equal(jobs.length, 21)
    assert.equal(jobs[0].city, 'Bangalore')
    assert.equal(jobs.at(-1)?.city, 'Chennai')
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper jobs-api mode overlaps detail fetches within a page to reduce per-source timeout pressure', async () => {
  const originalFetch = global.fetch
  const detailStarts = []
  const detailUrls = new Set([
    'https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/Bangalore-Karnataka-India/Engineer_R123',
    'https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/Chennai-Tamil-Nadu-India/Engineer_R124',
  ])

  let releaseDetails
  const detailsReleased = new Promise((resolve) => {
    releaseDetails = resolve
  })

  global.fetch = async (url, options = {}) => {
    if (detailUrls.has(url)) {
      detailStarts.push(url)
      if (detailStarts.length === 2) {
        releaseDetails()
      }

      await detailsReleased

      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <script type="application/ld+json">
                {
                  "@type": "JobPosting",
                  "description": "Job Description: Build useful systems.",
                  "identifier": { "value": "${url.endsWith('R123') ? 'R123' : 'R124'}" }
                }
              </script>
            </body>
          </html>
        `,
      }
    }

    if (options.method === 'POST') {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          total: 2,
          jobPostings: [
            {
              title: 'Engineer I',
              externalPath: '/job/Bangalore-Karnataka-India/Engineer_R123',
              locationsText: 'Bangalore, India',
              postedOn: 'Today',
            },
            {
              title: 'Engineer II',
              externalPath: '/job/Chennai-Tamil-Nadu-India/Engineer_R124',
              locationsText: 'Chennai, India',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        getSetCookie: () => [],
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => '<html><body>Target Workday shell</body></html>',
    }
  }

  try {
    const jobsPromise = runWorkdayScraper({
      company: 'Target',
      baseUrl: 'https://target.wd5.myworkdayjobs.com/en-US/targetcareers',
      locationCountry: null,
      source: 'target',
      scraperDir: path.join(testsDir, '../../scraper/target.workday'),
    })

    await Promise.race([
      detailsReleased,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Second detail request never started before the first one completed'))
        }, 200)
      }),
    ])

    const jobs = await jobsPromise
    assert.equal(detailStarts.length, 2)
    assert.equal(jobs.length, 2)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper preserves structured API outages without launching a browser', async () => {
  const originalFetch = global.fetch
  const calls = []
  let browserLaunches = 0
  const circuitBreaker = new WorkdayHostCircuitBreaker({
    failureThreshold: 10,
    cooldownMs: 60_000,
  })
  const page = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === 'ul[role="list"]') {
        throw new Error('Waiting for selector `ul[role="list"]` failed')
      }
      throw new Error('No cookie banner')
    },
    async $() { return null },
    async evaluate() { return null },
    async title() { return 'AT&T Careers' },
    async content() { return '<html><body>Careers</body></html>' },
    url() { return 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite' },
  }

  global.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ url, method })

    if (method === 'GET') {
      assert.equal(
        url,
        'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
      )
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>AT&T Workday shell</body></html>',
      }
    }

    assert.equal(method, 'POST')
    assert.equal(
      url,
      'https://att.wd1.myworkdayjobs.com/wday/cxs/att/ATTSpecialInvite/jobs',
    )
    return {
      ok: false,
      status: 503,
      url,
      headers: { get: () => 'text/html; charset=UTF-8' },
      text: async () => '<html><head><title>Workday is currently unavailable</title></head><body>maintenance</body></html>',
    }
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'AT&T',
        baseUrl: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite',
        locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
        source: 'att',
        scraperDir: path.join(testsDir, '../../scraper/att.workday'),
        launchBrowserImpl: async () => {
          browserLaunches += 1
          throw new Error('browser launch must remain unreachable')
        },
        createOptimizedPageImpl: async () => page,
        circuitBreaker,
      }),
      (error) => {
        assert.equal(error instanceof WorkdayUpstreamOutageError, true)
        assert.equal(error.softFailure, true)
        assert.match(error.message, /Workday is currently unavailable upstream/i)
        return true
      },
    )
    assert.deepEqual(
      calls.map((call) => call.method),
      ['GET', 'POST'],
    )
    assert.equal(browserLaunches, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper fails closed on inferred jobs API HTTP 400 without a browser fallback', async () => {
  const originalFetch = global.fetch
  const listingSection = new FakeDomElement({
    tagName: 'section',
    attributes: { 'data-automation-id': 'jobResults' },
    children: [
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer',
            href: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite/job/Bangalore-India/Engineer_R123',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Bangalore, India' }),
            ],
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'postedOn' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Today' }),
            ],
          }),
        ],
      }),
    ],
  })

  const listingPage = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      if (selector === 'section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]') {
        return {}
      }

      throw new Error(`Unexpected selector: ${selector}`)
    },
    async $() { return null },
    async $eval(selector, callback, selectors) {
      assert.equal(selector, 'section[data-automation-id="jobResults"]')
      return callback(listingSection, selectors)
    },
    async title() { return 'AT&T Careers' },
    async content() { return '<html><body>AT&T Careers</body></html>' },
    async evaluate() { return null },
    url() { return 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e' },
  }

  const pageQueue = [listingPage]
  let fetchCall = 0
  let browserLaunches = 0
  global.fetch = async (url, options = {}) => {
    fetchCall += 1

    if (fetchCall === 1) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>AT&T Workday shell</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      assert.equal(
        url,
        'https://att.wd1.myworkdayjobs.com/wday/cxs/att/ATTSpecialInvite/jobs',
      )
      return {
        ok: false,
        status: 400,
        url,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        text: async () => JSON.stringify({ errorCode: 'HTTP_400', httpStatus: 400 }),
      }
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <h1>Engineer</h1>
              <div>Bangalore, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build resilient customer systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'AT&T',
        baseUrl: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite',
        locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
        source: 'att',
        scraperDir: path.join(testsDir, '../../scraper/att.workday'),
        launchBrowserImpl: async () => {
          browserLaunches += 1
          throw new Error('browser launch must remain unreachable')
        },
        createOptimizedPageImpl: async () => pageQueue.shift(),
      }),
      (error) => {
        assert.equal(error.name, 'WorkdayJobsApiError')
        assert.equal(error.jobsApiHttpStatus, 400)
        assert.equal(error.abortRetries, true)
        return true
      },
    )

    assert.equal(browserLaunches, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper starts BrowserStack with India search text instead of the rejected generic country facet', async () => {
  const originalFetch = global.fetch
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn
  const calls = []
  const logMessages = []
  const warnMessages = []
  console.log = (...args) => {
    logMessages.push(args.join(' '))
  }
  console.warn = (...args) => {
    warnMessages.push(args.join(' '))
  }
  global.fetch = async (url, options = {}) => {
    const method = options.method || 'GET'
    const parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : null
    calls.push({ url, method, body: parsedBody })

    if (method === 'GET') {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>BrowserStack Workday shell</body></html>',
      }
    }

    if (method === 'POST' && parsedBody?.appliedFacets?.locationCountry) {
      return {
        ok: false,
        status: 400,
        url,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        text: async () => JSON.stringify({ errorCode: 'HTTP_400', httpStatus: 400 }),
      }
    }

    if (method === 'POST') {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        json: async () => ({
          total: 1,
          jobPostings: [
            {
              title: 'Senior Engineer',
              externalPath: '/job/Bangalore-India/Senior-Engineer_R1',
              locationsText: 'Bangalore, India',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <h1>Senior Engineer</h1>
              <div>Bangalore, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build browser automation systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'BrowserStack',
      baseUrl: 'https://browserstack.wd3.myworkdayjobs.com/External',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'browserstack',
      scraperDir: path.join(testsDir, '../../scraper/browserstack.workday'),
      launchBrowserImpl: async () => {
        throw new Error('DOM browser must not launch when the jobs API fallback succeeds')
      },
      createOptimizedPageImpl: async () => {
        throw new Error('DOM page must not launch when the jobs API fallback succeeds')
      },
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Senior Engineer')
    assert.equal(jobs[0].location, 'Bangalore, India')
    assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
    assert.deepEqual(calls[1].body, {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: 'India',
    })
    assert.equal(logMessages.some((message) => message.includes('rejected the generic country facet')), false)
    assert.equal(
      warnMessages.some((message) => message.includes('Workday jobs API rejected the generic country facet; retrying with India search text.')),
      false,
    )
  } finally {
    global.fetch = originalFetch
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
  }
})

test('runWorkdayScraper preserves a prefiltered Location_Country facet before retrying the inferred jobs API without it', async () => {
  const originalFetch = global.fetch
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn
  const calls = []
  const logMessages = []
  const warnMessages = []
  let postAttempt = 0
  console.log = (...args) => {
    logMessages.push(args.join(' '))
  }
  console.warn = (...args) => {
    warnMessages.push(args.join(' '))
  }

  global.fetch = async (url, options = {}) => {
    const method = options.method || 'GET'
    const parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : null
    calls.push({ url, method, body: parsedBody })

    if (method === 'GET' && !url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Nissan Workday shell</body></html>',
      }
    }

    if (method === 'POST' && postAttempt === 0) {
      postAttempt += 1
      assert.deepEqual(parsedBody.appliedFacets, {
        Location_Country: ['c4f78be1a8f14da0ab49ce1162348a5e'],
        Location_Region_State_Province: ['65209da0144c4c0a888940bb289f14bc'],
      })

      return {
        ok: false,
        status: 400,
        url,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        text: async () => JSON.stringify({ errorCode: 'HTTP_400', httpStatus: 400 }),
      }
    }

    if (method === 'POST' && postAttempt === 1) {
      postAttempt += 1
      assert.deepEqual(parsedBody.appliedFacets, {
        Location_Region_State_Province: ['65209da0144c4c0a888940bb289f14bc'],
      })
      assert.equal(parsedBody.searchText, 'India')

      return {
        ok: false,
        status: 400,
        url,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        text: async () => JSON.stringify({ errorCode: 'HTTP_400', httpStatus: 400 }),
      }
    }

    if (method === 'POST') {
      assert.deepEqual(parsedBody.appliedFacets, {})
      assert.equal(parsedBody.searchText, 'India')

      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        json: async () => ({
          total: 1,
          jobPostings: [
            {
              title: 'Senior Engineer',
              externalPath: '/job/Chennai-India/Senior-Engineer_R1',
              locationsText: 'Chennai, India',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <h1>Senior Engineer</h1>
              <div>Chennai, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build resilient automotive systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Nissan Digital India',
      baseUrl: 'https://alliance.wd3.myworkdayjobs.com/en-US/nissanjobs?Location_Country=c4f78be1a8f14da0ab49ce1162348a5e&Location_Region_State_Province=65209da0144c4c0a888940bb289f14bc',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'nissandigitalindia',
      scraperDir: path.join(testsDir, '../myworkday'),
      launchBrowserImpl: async () => {
        throw new Error('DOM browser must not launch when the retried jobs API works')
      },
    })

    assert.equal(calls.filter((call) => call.method === 'POST').length, 3)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].location, 'Chennai, India')
    assert.equal(jobs[0].city, 'Chennai')
    assert.match(
      logMessages.join('\n'),
      /Workday jobs API rejected the remaining location facets; retrying with India search text only\./,
    )
    assert.equal(
      warnMessages.some((message) => message.includes('Workday jobs API rejected the remaining location facets; retrying with India search text only.')),
      false,
    )
  } finally {
    global.fetch = originalFetch
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
  }
})

test('runWorkdayScraper logs HTTP 500 detail fallbacks to stdout without warning-stream noise', async () => {
  const originalFetch = global.fetch
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn
  const logMessages = []
  const warnMessages = []
  const detailUrls = []

  console.log = (...args) => {
    logMessages.push(args.join(' '))
  }
  console.warn = (...args) => {
    warnMessages.push(args.join(' '))
  }

  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url)
    const method = options.method || 'GET'

    if (method === 'GET' && !requestUrl.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url: requestUrl,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>GE Appliances Workday shell</body></html>',
      }
    }

    if (method === 'POST') {
      return {
        ok: true,
        status: 200,
        url: requestUrl,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        json: async () => ({
          total: 1,
          jobPostings: [
            {
              title: 'Intern - Intellectual Property',
              externalPath: '/job/IND-Bangalore-KA/Intern---Intellectual-Property_REQ-26215',
              locationsText: 'Bangalore, India',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    if (requestUrl.includes('/job/')) {
      detailUrls.push(requestUrl)
      return {
        ok: false,
        status: 500,
        url: requestUrl,
        headers: { get: () => 'text/html; charset=UTF-8' },
        text: async () => '<html><body>Internal Server Error</body></html>',
      }
    }

    throw new Error(`Unexpected fetch URL: ${requestUrl}`)
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'GE Appliances',
      baseUrl: 'https://haier.wd3.myworkdayjobs.com/en-US/GE_Appliances',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'geappliances',
      scraperDir: path.join(testsDir, '../../scraper/geappliances.workday'),
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Intern - Intellectual Property')
    assert.equal(jobs[0].location, 'Bangalore, India')
    assert.equal(detailUrls.length, 1)
    assert.match(
      logMessages.join('\n'),
      /Failed to enrich details for .*Intern---Intellectual-Property_REQ-26215; keeping listing data when summary location remains safely in scope: \[geappliances\] Workday jobs API returned HTTP_500/,
    )
    assert.equal(
      warnMessages.some((message) => message.includes('Failed to enrich details for')),
      false,
    )
  } finally {
    global.fetch = originalFetch
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
  }
})

test('runWorkdayScraper logs HTTP 429 detail fallback notices to stdout and disables later detail fetches', async () => {
  const originalFetch = global.fetch
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn
  const originalDetailConcurrency = process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY
  const logMessages = []
  const warnMessages = []
  const detailUrls = []

  process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY = '1'
  console.log = (...args) => {
    logMessages.push(args.join(' '))
  }
  console.warn = (...args) => {
    warnMessages.push(args.join(' '))
  }

  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url)
    const method = options.method || 'GET'

    if (method === 'GET' && !requestUrl.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url: requestUrl,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>GE Appliances Workday shell</body></html>',
      }
    }

    if (method === 'POST') {
      return {
        ok: true,
        status: 200,
        url: requestUrl,
        headers: { get: () => 'application/json;charset=ISO-8859-1' },
        json: async () => ({
          total: 2,
          jobPostings: [
            {
              title: 'Senior Engineer',
              externalPath: '/job/IND-Bangalore-KA/Senior-Engineer_REQ-1',
              locationsText: 'Bangalore, India',
              postedOn: 'Today',
            },
            {
              title: 'Principal Engineer',
              externalPath: '/job/IND-Hyderabad-TS/Principal-Engineer_REQ-2',
              locationsText: 'Hyderabad, India',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    if (requestUrl.includes('/job/')) {
      detailUrls.push(requestUrl)
      return {
        ok: false,
        status: 429,
        url: requestUrl,
        headers: { get: () => 'text/html; charset=UTF-8' },
        text: async () => '<html><body>Too Many Requests</body></html>',
      }
    }

    throw new Error(`Unexpected fetch URL: ${requestUrl}`)
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'GE Appliances',
      baseUrl: 'https://haier.wd3.myworkdayjobs.com/en-US/GE_Appliances',
      locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
      source: 'geappliances',
      scraperDir: path.join(testsDir, '../../scraper/geappliances.workday'),
    })

    assert.equal(jobs.length, 2)
    assert.deepEqual(
      jobs.map((job) => job.location),
      ['Bangalore, India', 'Hyderabad, India'],
    )
    assert.equal(detailUrls.length, 1)
    assert.match(
      logMessages.join('\n'),
      /Failed to enrich details for .*Senior-Engineer_REQ-1; keeping listing data when summary location remains safely in scope: \[geappliances\] Workday jobs API returned HTTP_429/,
    )
    assert.match(
      logMessages.join('\n'),
      /Workday detail requests became unstable; continuing with listing-backed data for the remaining jobs on this source\./,
    )
    assert.equal(
      warnMessages.some((message) => message.includes('Failed to enrich details for')),
      false,
    )
    assert.equal(
      warnMessages.some((message) => message.includes('Workday detail requests became unstable')),
      false,
    )
  } finally {
    global.fetch = originalFetch
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    if (originalDetailConcurrency == null) {
      delete process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY
    } else {
      process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY = originalDetailConcurrency
    }
  }
})

test('runWorkdayScraper fails closed on explicit jobs API HTTP 429 without a browser fallback', async () => {
  const originalFetch = global.fetch
  const listingSection = new FakeDomElement({
    tagName: 'section',
    attributes: { 'data-automation-id': 'jobResults' },
    children: [
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer',
            href: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus/job/Bangalore-India/Engineer_R123',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Bangalore, India' }),
            ],
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'postedOn' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Today' }),
            ],
          }),
        ],
      }),
    ],
  })

  const listingPage = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      if (selector === 'section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]') {
        return {}
      }

      throw new Error(`Unexpected selector: ${selector}`)
    },
    async $() { return null },
    async $eval(selector, callback, selectors) {
      assert.equal(selector, 'section[data-automation-id="jobResults"]')
      return callback(listingSection, selectors)
    },
    async title() { return 'Airbus Careers' },
    async content() { return '<html><body>Airbus Careers</body></html>' },
    async evaluate() { return null },
    url() { return 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e' },
  }

  const pageQueue = [listingPage]
  let fetchCall = 0
  let browserLaunches = 0
  global.fetch = async (url, options = {}) => {
    fetchCall += 1

    if ((options.method || 'GET') === 'GET' && !url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Airbus Workday shell</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      assert.equal(
        url,
        'https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus/jobs',
      )
      return {
        ok: false,
        status: 429,
        url,
        headers: { get: () => 'application/json;charset=UTF-8' },
        text: async () => JSON.stringify({ errorCode: 'HTTP_429', httpStatus: 429 }),
      }
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <h1>Engineer</h1>
              <div>Bangalore, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build resilient aviation systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'Airbus',
        baseUrl: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus',
        locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
        source: 'airbus',
        scraperDir: path.join(testsDir, '../../scraper/airbus.workday'),
        retryBaseDelayMs: 0,
        circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
        detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
        launchBrowserImpl: async () => {
          browserLaunches += 1
          throw new Error('browser launch must remain unreachable')
        },
        createOptimizedPageImpl: async () => pageQueue.shift(),
      }),
      (error) => {
        assert.equal(error.name, 'WorkdayJobsApiError')
        assert.equal(error.jobsApiHttpStatus, 429)
        assert.equal(error.abortRetries, true)
        return true
      },
    )

    assert.equal(browserLaunches, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper fails closed without a browser fallback when the jobs API transport times out', async () => {
  const originalFetch = global.fetch
  const listingSection = new FakeDomElement({
    tagName: 'section',
    attributes: { 'data-automation-id': 'jobResults' },
    children: [
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer',
            href: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus/job/Bangalore-India/Engineer_R123',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Bangalore, India' }),
            ],
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'postedOn' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Today' }),
            ],
          }),
        ],
      }),
    ],
  })

  const listingPage = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      if (selector === 'section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]') {
        return {}
      }

      throw new Error(`Unexpected selector: ${selector}`)
    },
    async $() { return null },
    async $eval(selector, callback, selectors) {
      assert.equal(selector, 'section[data-automation-id="jobResults"]')
      return callback(listingSection, selectors)
    },
    async title() { return 'Airbus Careers' },
    async content() { return '<html><body>Airbus Careers</body></html>' },
    async evaluate() { return null },
    url() { return 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e' },
  }

  const pageQueue = [listingPage]
  let browserLaunched = false

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET' && !url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Airbus Workday shell</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      const error = new TypeError('fetch failed | Connect Timeout Error')
      error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
      throw error
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <h1>Engineer</h1>
              <div>Bangalore, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build resilient aviation systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'Airbus',
        baseUrl: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus',
        locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
        source: 'airbus',
        scraperDir: path.join(testsDir, '../../scraper/airbus.workday'),
        retryBaseDelayMs: 0,
        circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
        detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
        launchBrowserImpl: async () => {
          browserLaunched = true
          throw new Error('browser launch must remain unreachable')
        },
        createOptimizedPageImpl: async () => pageQueue.shift(),
      }),
      (error) => {
        assert.equal(error.softFailure, true)
        assert.equal(error.abortRetries, true)
        assert.equal(error.failureKind, 'network_or_timeout')
        return true
      },
    )

    assert.equal(browserLaunched, false)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper never retries a failed jobs API through the DOM listing', async () => {
  const originalFetch = global.fetch
  const listingSection = new FakeDomElement({
    tagName: 'section',
    attributes: { 'data-automation-id': 'jobResults' },
    children: [
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer',
            href: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus/job/Bangalore-India/Engineer_R123',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Bangalore, India' }),
            ],
          }),
        ],
      }),
    ],
  })

  let waitAttempts = 0
  let gotoCalls = 0
  let browserLaunched = false
  const listingPage = {
    on() {},
    async goto() {
      gotoCalls += 1
    },
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      if (selector === 'section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]') {
        waitAttempts += 1
        if (waitAttempts === 1) {
          throw new Error('Waiting for selector `section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]` failed')
        }
        return {}
      }

      throw new Error(`Unexpected selector: ${selector}`)
    },
    async $() { return null },
    async $eval(selector, callback, selectors) {
      assert.equal(selector, 'section[data-automation-id="jobResults"]')
      return callback(listingSection, selectors)
    },
    async title() { return 'Airbus Careers' },
    async content() { return '<html><body>Airbus Careers</body></html>' },
    async evaluate() { return null },
    url() { return 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e' },
  }

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET' && !url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Airbus Workday shell</body></html>',
      }
    }

    if ((options.method || 'GET') === 'POST') {
      const error = new TypeError('fetch failed | Connect Timeout Error')
      error.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }
      throw error
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <h1>Engineer</h1>
              <div>Bangalore, India</div>
              <section>
                <h2>Job Description</h2>
                <p>Build resilient aviation systems.</p>
              </section>
            </body>
          </html>
        `,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'Airbus',
        baseUrl: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus',
        locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
        source: 'airbus',
        scraperDir: path.join(testsDir, '../../scraper/airbus.workday'),
        retryBaseDelayMs: 0,
        circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
        detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
        launchBrowserImpl: async () => {
          browserLaunched = true
          throw new Error('browser launch must remain unreachable')
        },
        createOptimizedPageImpl: async () => listingPage,
      }),
      (error) => {
        assert.equal(error.abortRetries, true)
        assert.equal(error.failureKind, 'network_or_timeout')
        return true
      },
    )

    assert.equal(browserLaunched, false)
    assert.equal(waitAttempts, 0)
    assert.equal(gotoCalls, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper does not launch DOM fallback after an API request deadline', async () => {
  const originalFetch = global.fetch
  let browserLaunched = false

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'GET') {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          getSetCookie: () => [],
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => '<html><body>Workday shell</body></html>',
      }
    }

    return new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        reject(options.signal.reason)
      }, { once: true })
    })
  }

  try {
    await assert.rejects(
      Promise.race([
        runWorkdayScraper({
          company: 'Timeout Test',
          baseUrl: 'https://no-dom-timeout-test.wd5.myworkdayjobs.com/External',
          locationCountry: 'india-id',
          source: 'no-dom-timeout-test',
          scraperDir: path.join(testsDir, '../myworkday'),
          requestTimeoutMs: 10,
          retryBaseDelayMs: 0,
          circuitBreaker: new WorkdayHostCircuitBreaker(),
          detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
          launchBrowserImpl: async () => {
            browserLaunched = true
            return { close: async () => {} }
          },
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('request deadline was not enforced')), 100)
        }),
      ]),
      (error) => {
        assert.equal(error.name, 'WorkdayRequestTimeoutError')
        return true
      },
    )
    assert.equal(browserLaunched, false)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper rejects an uninferable non-Workday board before creating a browser page', async () => {
  const extractionError = new Error('DOM extraction exploded')
  let browserLaunches = 0
  const page = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      return {}
    },
    async $() { return null },
    async $eval() { throw extractionError },
    async evaluate() { return null },
    async title() { return 'Example Careers' },
    async content() { return '<html><body>Careers</body></html>' },
    url() { return 'https://careers.example.com/workday' },
  }

  await assert.rejects(
    runWorkdayScraper({
      company: 'Example',
      baseUrl: 'https://careers.example.com/workday',
      locationCountry: null,
      source: 'example-dom-extraction',
      scraperDir: path.join(testsDir, '../myworkday'),
      launchBrowserImpl: async () => {
        browserLaunches += 1
        return { close: async () => {} }
      },
      createOptimizedPageImpl: async () => page,
    }),
    /could not infer a public Workday jobs API/i,
  )
  assert.equal(browserLaunches, 0)
})

test('runWorkdayScraper rejects API HTTP 418 without attempting DOM card extraction', async () => {
  const originalFetch = global.fetch
  const listingSection = new FakeDomElement({
    tagName: 'section',
    attributes: { 'data-automation-id': 'jobResults' },
    children: [
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer',
            href: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite/job/Bangalore-India/Engineer_R123',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Bangalore, India' }),
            ],
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'postedOn' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Today' }),
            ],
          }),
        ],
      }),
    ],
  })

  const listingPage = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      if (selector === 'section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]') {
        return {}
      }

      throw new Error(`Unexpected selector: ${selector}`)
    },
    async $() { return null },
    async $eval(selector, callback, selectors) {
      assert.equal(selector, 'section[data-automation-id="jobResults"]')
      return callback(listingSection, selectors)
    },
    async title() { return 'AT&T Careers' },
    async content() { return '<html><body>AT&T Careers</body></html>' },
    async evaluate() { return null },
    url() { return 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e' },
  }

  const pageQueue = [listingPage]
  let fetchCall = 0
  let browserLaunches = 0
  global.fetch = async (url, options = {}) => {
    fetchCall += 1

    if ((options.method || 'GET') === 'POST') {
      assert.equal(
        url,
        'https://att.wd1.myworkdayjobs.com/wday/cxs/att/ATTSpecialInvite/jobs',
      )
      return {
        ok: false,
        status: 418,
        url,
        headers: { get: () => 'text/plain; charset=UTF-8' },
        text: async () => 'teapot',
      }
    }

    if (url.includes('/job/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: () => 'text/html; charset=UTF-8',
        },
        text: async () => `
          <html>
            <body>
              <script type="application/ld+json">
                {
                  "@type": "JobPosting",
                  "description": "Job Description: Build useful systems.",
                  "identifier": { "value": "R123" }
                }
              </script>
            </body>
          </html>
        `,
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        getSetCookie: () => [],
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => '<html><body>AT&T Workday shell</body></html>',
    }
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'AT&T',
        baseUrl: 'https://att.wd1.myworkdayjobs.com/ATTSpecialInvite',
        locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
        source: 'att',
        scraperDir: path.join(testsDir, '../../scraper/att.workday'),
        launchBrowserImpl: async () => {
          browserLaunches += 1
          throw new Error('browser launch must remain unreachable')
        },
        createOptimizedPageImpl: async () => pageQueue.shift(),
      }),
      (error) => {
        assert.equal(error.name, 'WorkdayJobsApiError')
        assert.equal(error.jobsApiHttpStatus, 418)
        assert.equal(error.abortRetries, true)
        return true
      },
    )

    assert.equal(browserLaunches, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test('runWorkdayScraper never starts DOM detail work for an uninferable API configuration', async () => {
  const originalFetch = global.fetch
  let browserLaunches = 0
  const listingSection = new FakeDomElement({
    tagName: 'section',
    attributes: { 'data-automation-id': 'jobResults' },
    children: [
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer I',
            href: 'https://careers.example.com/job/Bangalore-India/Engineer_R123',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Bangalore, India' }),
            ],
          }),
        ],
      }),
      new FakeDomElement({
        tagName: 'div',
        attributes: { role: 'listitem' },
        children: [
          new FakeDomElement({
            tagName: 'a',
            attributes: { 'data-automation-id': 'jobTitle' },
            innerText: 'Engineer II',
            href: 'https://careers.example.com/job/Chennai-India/Engineer_R124',
          }),
          new FakeDomElement({
            tagName: 'div',
            attributes: { 'data-automation-id': 'locations' },
            children: [
              new FakeDomElement({ tagName: 'dd', innerText: 'Chennai, India' }),
            ],
          }),
        ],
      }),
    ],
  })

  const listingPage = {
    on() {},
    async goto() {},
    async waitForSelector(selector) {
      if (selector === '[data-automation-id="legalNoticeAcceptButton"]') {
        throw new Error('No cookie banner')
      }
      if (selector === 'section[data-automation-id="jobResults"] [data-automation-id="jobTitle"]') {
        return {}
      }

      throw new Error(`Unexpected selector: ${selector}`)
    },
    async $() { return null },
    async $eval(selector, callback, selectors) {
      assert.equal(selector, 'section[data-automation-id="jobResults"]')
      return callback(listingSection, selectors)
    },
    async title() { return 'Example Careers' },
    async content() { return '<html><body>Example Careers</body></html>' },
    async evaluate() { return null },
    url() { return 'https://careers.example.com/workday?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e' },
  }

  const detailPage = {
    async goto() {},
    async waitForSelector() { return {} },
    async content() {
      return `
        <html>
          <body>
            <script type="application/ld+json">
              {
                "@type": "JobPosting",
                "description": "Job Description: Build useful systems.",
                "identifier": { "value": "R123" }
              }
            </script>
          </body>
        </html>
      `
    },
  }

  const detailStarts = []
  const detailUrls = new Set([
    'https://careers.example.com/job/Bangalore-India/Engineer_R123',
    'https://careers.example.com/job/Chennai-India/Engineer_R124',
  ])

  let releaseDetails
  const detailsReleased = new Promise((resolve) => {
    releaseDetails = resolve
  })

  global.fetch = async (url) => {
    if (!detailUrls.has(url)) {
      throw new Error(`Unexpected fetch: ${url}`)
    }

    detailStarts.push(url)
    if (detailStarts.length === 2) {
      releaseDetails()
    }

    await detailsReleased

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => `
        <html>
          <body>
            <script type="application/ld+json">
              {
                "@type": "JobPosting",
                "description": "Job Description: Build useful systems.",
                "identifier": { "value": "${url.endsWith('R123') ? 'R123' : 'R124'}" }
              }
            </script>
          </body>
        </html>
      `,
    }
  }

  try {
    await assert.rejects(
      runWorkdayScraper({
        company: 'Example',
        baseUrl: 'https://careers.example.com/workday',
        locationCountry: null,
        source: 'example-workday-dom',
        scraperDir: path.join(testsDir, '../myworkday'),
        launchBrowserImpl: async () => {
          browserLaunches += 1
          return { close: async () => {} }
        },
        createOptimizedPageImpl: async () => (
          listingPage
            || detailPage
        ),
      }),
      /could not infer a public Workday jobs API/i,
    )

    assert.equal(browserLaunches, 0)
    assert.equal(detailStarts.length, 0)
  } finally {
    global.fetch = originalFetch
  }
})
