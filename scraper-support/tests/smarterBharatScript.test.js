import assert from 'node:assert/strict'
import test from 'node:test'

const loadSmarterBharatModule = async () => {
  try {
    return await import('../../scraper/smarterbharat/script.js')
  } catch {
    assert.fail('Expected SmarterBharat scraper module at ../../scraper/smarterbharat/script.js')
  }
}

test('SmarterBharat sentinel helpers stay pinned to the verified absent exact-name domain candidates', async () => {
  const smarterBharat = await loadSmarterBharatModule()

  assert.equal(smarterBharat.SOURCE, 'smarterbharat')
  assert.equal(smarterBharat.COMPANY, 'SmarterBharat')
  assert.equal(smarterBharat.OFFICIAL_BRAND_NAME, 'SmarterBharat')
  assert.equal(smarterBharat.VERIFIED_ON, '2026-07-17')
  assert.deepEqual(smarterBharat.CANDIDATE_FIRST_PARTY_URLS, [
    'https://smarterbharat.com/',
    'https://www.smarterbharat.com/',
    'https://smarterbharat.in/',
    'https://www.smarterbharat.in/',
    'https://smarterbharat.ai/',
    'https://www.smarterbharat.ai/',
    'https://smarterbharat.io/',
    'https://www.smarterbharat.io/',
  ])
  assert.equal(
    smarterBharat.isExpectedAbsentCandidateSurface({ errorKind: 'dns', status: null, html: null }),
    true,
  )
  assert.equal(
    smarterBharat.isExpectedAbsentCandidateSurface({ errorKind: 'timeout', status: null, html: null }),
    false,
  )
  assert.equal(
    smarterBharat.isUnexpectedReachableSurface({ status: 200, html: '<html><body>SmarterBharat</body></html>' }),
    true,
  )
  assert.equal(
    smarterBharat.isExpectedVerificationFailure({ message: 'curl: (6) Could not resolve host: smarterbharat.com' }),
    true,
  )
  assert.equal(typeof smarterBharat.classifyProbeErrorKind, 'function')
  assert.equal(
    smarterBharat.classifyProbeErrorKind({
      message: 'fetch failed',
      causeMessage: 'getaddrinfo ENOTFOUND smarterbharat.com',
    }),
    'dns',
  )
})

test('SmarterBharat returns [] only while all exact-name first-party candidates remain unresolved or untrusted', async () => {
  const smarterBharat = await loadSmarterBharatModule()
  const requestedUrls = []

  const jobs = await smarterBharat.createSmarterBharatScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return { url, finalUrl: url, status: null, html: null, errorKind: 'dns' }
    },
  })

  assert.deepEqual(requestedUrls, smarterBharat.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])

  await assert.rejects(
    smarterBharat.createSmarterBharatScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://smarterbharat.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>SmarterBharat</h1></body></html>',
            errorKind: null,
          }
        }

        return { url, finalUrl: url, status: null, html: null, errorKind: 'dns' }
      },
    }),
    /first-party candidate surface/i,
  )

  await assert.rejects(
    smarterBharat.createSmarterBharatScraper().run({
      probeUrl: async (url) => ({ url, finalUrl: url, status: null, html: null, errorKind: 'network' }),
    }),
    /changed materially/i,
  )
})
