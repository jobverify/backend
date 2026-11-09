import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchWorkdayJobsApiPage } from '../myworkday/engine.js'

const createResponse = ({
  body = '',
  status = 200,
  headers = {},
} = {}) => new Response(body, { status, headers })

test('fetchWorkdayJobsApiPage retries a transient bootstrap 429 before calling the jobs API', async () => {
  const originalFetch = global.fetch
  const calls = []

  global.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
    })

    if (calls.length === 1) {
      return createResponse({
        body: '<html><body>Too many requests</body></html>',
        status: 429,
        headers: {
          'content-type': 'text/html',
          'retry-after': '0',
        },
      })
    }

    if (calls.length === 2) {
      return createResponse({
        body: '<html><body>OK</body></html>',
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      })
    }

    if (calls.length === 3) {
      return createResponse({
        body: JSON.stringify({
          total: 0,
          jobPostings: [],
        }),
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    throw new Error(`Unexpected extra fetch call for ${url}`)
  }

  try {
    const payload = await fetchWorkdayJobsApiPage({
      bootstrapUrl: 'https://autodesk.wd1.myworkdayjobs.com/en-US/uni?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
      jobsApiUrl: 'https://autodesk.wd1.myworkdayjobs.com/wday/cxs/autodesk/uni/jobs',
      appliedFacets: {
        locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
      },
      offset: 0,
      source: 'autodesk',
      retryBaseDelayMs: 1,
    })

    assert.deepEqual(payload, {
      total: 0,
      jobPostings: [],
    })
    assert.deepEqual(
      calls.map(({ method }) => method),
      ['GET', 'GET', 'POST'],
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('fetchWorkdayJobsApiPage recovers from repeated transient jobs API 429 responses', async () => {
  const originalFetch = global.fetch
  const calls = []

  global.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
    })

    if (calls.length === 1) {
      return createResponse({
        body: '<html><body>OK</body></html>',
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      })
    }

    if (calls.length === 2 || calls.length === 3) {
      return createResponse({
        body: JSON.stringify({
          errorCode: 'HTTP_429',
          httpStatus: 429,
        }),
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '0',
        },
      })
    }

    if (calls.length === 4) {
      return createResponse({
        body: JSON.stringify({
          total: 0,
          jobPostings: [],
        }),
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    throw new Error(`Unexpected extra fetch call for ${url}`)
  }

  try {
    const payload = await fetchWorkdayJobsApiPage({
      bootstrapUrl: 'https://mastercard.wd1.myworkdayjobs.com/CorporateCareers',
      jobsApiUrl: 'https://mastercard.wd1.myworkdayjobs.com/wday/cxs/mastercard/CorporateCareers/jobs',
      appliedFacets: {
        locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
      },
      offset: 0,
      source: 'mastercard',
      retryBaseDelayMs: 1,
    })

    assert.deepEqual(payload, {
      total: 0,
      jobPostings: [],
    })
    assert.deepEqual(
      calls.map(({ method }) => method),
      ['GET', 'POST', 'POST', 'POST'],
    )
  } finally {
    global.fetch = originalFetch
  }
})
