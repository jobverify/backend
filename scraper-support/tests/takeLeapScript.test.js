import assert from 'node:assert/strict'
import test from 'node:test'

const loadTakeLeapModule = async () => {
  try {
    return await import('../../scraper/takeleap/script.js')
  } catch {
    assert.fail('Expected TakeLeap scraper module at ../../scraper/takeleap/script.js')
  }
}

test('TakeLeap scraper constants stay pinned to the verified timeout-only first-party brochure surface', async () => {
  const takeLeap = await loadTakeLeapModule()

  assert.equal(takeLeap.SOURCE, 'takeleap')
  assert.equal(takeLeap.COMPANY, 'TakeLeap')
  assert.equal(takeLeap.COMPANY_DOMAIN, 'takeleap.com')
  assert.equal(takeLeap.VERIFIED_AT, '2026-07-17')
  assert.deepEqual(takeLeap.FIRST_PARTY_TIMEOUT_URLS, [
    'https://takeleap.com/',
    'https://takeleap.com/about-us',
    'https://takeleap.com/contact/',
    'https://takeleap.com/careers',
    'https://takeleap.com/career',
    'https://takeleap.com/jobs',
    'https://takeleap.com/join-us',
    'https://takeleap.com/work-with-us',
    'https://takeleap.com/openings',
  ])
  assert.equal(takeLeap.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(takeLeap.isExpectedTimedOutSurface({ errorKind: 'dns' }), false)
  assert.equal(
    takeLeap.isUnexpectedReachableSurface({
      status: 200,
      html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>',
    }),
    true,
  )
  assert.equal(takeLeap.isUnexpectedReachableSurface({ errorKind: 'timeout' }), false)
})

test('TakeLeap run verifies the exact-name first-party routes before returning []', async () => {
  const takeLeap = await loadTakeLeapModule()
  const requestedUrls = []

  const jobs = await takeLeap.createTakeLeapScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (takeLeap.FIRST_PARTY_TIMEOUT_URLS.includes(url)) {
        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'timeout',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, takeLeap.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])
})

test('TakeLeap fails closed when a first-party route becomes reachable or changes away from the verified timeout state', async () => {
  const takeLeap = await loadTakeLeapModule()

  await assert.rejects(
    takeLeap.createTakeLeapScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://takeleap.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>TakeLeap</title><body>Homepage now responds.</body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'timeout',
        }
      },
    }),
    /official first-party route/i,
  )

  await assert.rejects(
    takeLeap.createTakeLeapScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://takeleap.com/careers') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'timeout',
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    takeLeap.createTakeLeapScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }),
    }),
    /verified timed-out surface changed materially/i,
  )
})
