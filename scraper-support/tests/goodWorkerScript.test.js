import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/goodworker/script.js')
  } catch {
    assert.fail('Expected GoodWorker scraper module at ../../scraper/goodworker/script.js')
  }
}

test('GoodWorker helpers stay pinned to the verified timeout-only first-party surface from Friday, July 17, 2026', async () => {
  const goodWorker = await loadModule()

  assert.equal(goodWorker.SOURCE, 'goodworker')
  assert.equal(goodWorker.COMPANY, 'GoodWorker')
  assert.equal(goodWorker.COMPANY_DOMAIN, 'goodworker.in')
  assert.equal(goodWorker.VERIFIED_AT, '2026-07-17')
  assert.deepEqual(goodWorker.FIRST_PARTY_TIMEOUT_URLS, [
    'https://goodworker.in/',
    'https://goodworker.in/careers',
  ])
  assert.equal(goodWorker.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(goodWorker.isExpectedTimedOutSurface({ errorKind: 'dns' }), false)
  assert.equal(
    goodWorker.isUnexpectedReachableSurface({
      status: 200,
      html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>',
    }),
    true,
  )
  assert.equal(goodWorker.isUnexpectedReachableSurface({ errorKind: 'timeout' }), false)
})

test('GoodWorker run verifies the exact-name first-party routes before returning []', async () => {
  const goodWorker = await loadModule()
  const requestedUrls = []

  const jobs = await goodWorker.createGoodWorkerScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (goodWorker.FIRST_PARTY_TIMEOUT_URLS.includes(url)) {
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

  assert.deepEqual(requestedUrls, goodWorker.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])
})

test('GoodWorker fails closed when a first-party route becomes reachable or changes away from the verified timeout state', async () => {
  const goodWorker = await loadModule()

  await assert.rejects(
    goodWorker.createGoodWorkerScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://goodworker.in/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>GoodWorker</title><body>Homepage now responds.</body></html>',
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
    goodWorker.createGoodWorkerScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://goodworker.in/careers') {
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
    goodWorker.createGoodWorkerScraper().run({
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
