import assert from 'node:assert/strict'
import test from 'node:test'

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/schoogly/script.js')
  } catch {
    assert.fail('Expected Schoogly scraper module at ../../scraper/schoogly/script.js')
  }
}

test('Schoogly sentinel helpers stay pinned to the verified timeout-only exact-name routes', async () => {
  const schoogly = await loadScriptModule()

  assert.equal(schoogly.SOURCE, 'schoogly')
  assert.equal(schoogly.COMPANY, 'Schoogly')
  assert.equal(schoogly.OFFICIAL_BRAND_NAME, 'Schoogly')
  assert.equal(schoogly.VERIFIED_ON, '2026-07-17')
  assert.deepEqual(schoogly.FIRST_PARTY_TIMEOUT_URLS, [
    'https://schoogly.com/',
    'https://www.schoogly.com/',
    'https://schoogly.com/careers',
    'https://www.schoogly.com/careers',
    'https://schoogly.com/jobs',
    'https://www.schoogly.com/jobs',
  ])
  assert.equal(schoogly.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(schoogly.isExpectedTimedOutSurface({ errorKind: 'dns', status: null, html: null }), false)
  assert.equal(
    schoogly.isUnexpectedReachableSurface({
      status: 200,
      html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
    }),
    true,
  )
  assert.equal(
    schoogly.isExpectedVerificationFailure({
      message: 'curl: (28) Connection timed out after 5004 milliseconds',
    }),
    true,
  )
})

test('Schoogly returns [] only while the exact-name first-party candidates remain timed out and fails closed on drift', async () => {
  const schoogly = await loadScriptModule()
  const requestedUrls = []

  const jobs = await schoogly.createSchooglyScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return { url, finalUrl: url, status: null, html: null, errorKind: 'timeout' }
    },
  })

  assert.deepEqual(requestedUrls, schoogly.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])

  await assert.rejects(
    schoogly.createSchooglyScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://schoogly.com/jobs') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
            errorKind: null,
          }
        }

        return { url, finalUrl: url, status: null, html: null, errorKind: 'timeout' }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    schoogly.createSchooglyScraper().run({
      probeUrl: async (url) => ({ url, finalUrl: url, status: null, html: null, errorKind: 'dns' }),
    }),
    /changed materially/i,
  )
})
