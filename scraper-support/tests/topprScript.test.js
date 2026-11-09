import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML_REQUIRES_REVIEW = `
<!doctype html>
<html lang="en">
  <head>
    <title>Toppr Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers at Toppr</h1>
      <p>Join our team of builders and educators.</p>
    </main>
  </body>
</html>
`

const CAREERS_HTML_WITH_PUBLIC_JOBS = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://toppr.jobsoid.com/">Apply now</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/toppr/script.js')
  } catch {
    assert.fail('Expected Toppr scraper module at ../../scraper/toppr/script.js')
  }
}

test('Toppr sentinel helpers stay pinned to the exact-name routes and standalone Jobsoid board evidence', async () => {
  const toppr = await loadScriptModule()

  assert.equal(toppr.SOURCE, 'toppr')
  assert.equal(toppr.COMPANY, 'Toppr')
  assert.equal(toppr.OFFICIAL_BRAND_NAME, 'Toppr')
  assert.equal(toppr.VERIFIED_ON, '2026-07-17')
  assert.equal(toppr.HOMEPAGE_URL, 'https://www.toppr.com/')
  assert.equal(toppr.CAREERS_URL, 'https://www.toppr.com/careers')
  assert.equal(toppr.STANDALONE_JOBS_BOARD_URL, 'https://toppr.jobsoid.com/')
  assert.deepEqual(toppr.extractTrustedPublicJobLinks(CAREERS_HTML_REQUIRES_REVIEW), [])
  assert.deepEqual(toppr.extractTrustedPublicJobLinks(CAREERS_HTML_WITH_PUBLIC_JOBS), ['https://toppr.jobsoid.com/'])
  assert.equal(toppr.pageExposesPublicJobListings(CAREERS_HTML_REQUIRES_REVIEW), false)
  assert.equal(toppr.pageExposesPublicJobListings(CAREERS_HTML_WITH_PUBLIC_JOBS), true)
  assert.equal(
    toppr.isExpectedVerificationFailure({
      message: 'fetch failed',
      cause: {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.toppr.com:443, timeout: 10000ms)',
      },
    }),
    true,
  )
  assert.equal(
    toppr.isExpectedVerificationFailure({
      message: 'The underlying connection was closed: Could not establish trust relationship for the SSL/TLS secure channel.',
    }),
    true,
  )
  assert.equal(
    toppr.isExpectedVerificationFailure(new TypeError('fetch failed')),
    true,
  )
})

test('Toppr returns [] while the exact-name careers route remains unverifiable and fails closed when that surface changes', async () => {
  const toppr = await loadScriptModule()
  const requestedUrls = []

  const jobs = await toppr.createTopprScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      throw new TypeError('The underlying connection was closed: Could not establish trust relationship for the SSL/TLS secure channel.')
    },
  })

  assert.deepEqual(requestedUrls, [toppr.CAREERS_URL])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    toppr.createTopprScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: toppr.CAREERS_URL,
        html: CAREERS_HTML_WITH_PUBLIC_JOBS,
      }),
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    toppr.createTopprScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: toppr.CAREERS_URL,
        html: CAREERS_HTML_REQUIRES_REVIEW,
      }),
    }),
    /requires re-verification/i,
  )
})
