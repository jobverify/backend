import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers at Sula</h1>
      <p>As pioneers and leaders in the Indian wine industry, we're committed to creating great memories that start with a bottle of Sula!</p>
      <p>At Sula, we believe in a supportive, open-door culture and place a strong emphasis on Learning and Development opportunities for our teams to grow at every level of their professional journey.</p>
      <p>We have both full-time as well as internship positions available across all our departments.</p>
      <a href="https://app.hrone.cloud/career-portal?appId=MHZzWpATk5uSVkWo1EwlhxzjgIG1VZ3pIZYpNVctJxMlUQo18qUoCm-17Y6BMlv4l0Cqdw6PNgHEZKAACmWo7upw3Rwo24m2v5XmXqZ2XGYc1Q2nq54JyLnImKiiIoss&dc=sula&rqt=m8jH4bpBQbccEU8MZpSP5Q&cc=eaqzS8e-weZZc3W_dw_T1Q">View Open Positions</a>
      <footer>
        <p>Sula Vineyards Limited. All rights reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const HRONE_JS_STUB_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <p>Your browser does not support JavaScript!</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Roles at Sula</h1>
    <a href="https://app.hrone.cloud/career-portal/jobs/finance-executive">Finance Executive</a>
    <button>Apply Now</button>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sulavineyards/script.js')
  } catch {
    assert.fail('Expected Sula Vineyards scraper module at ../../scraper/sulavineyards/script.js')
  }
}

test('Sula Vineyards sentinel helpers stay pinned to the verified careers page and opaque HROne handoff', async () => {
  const sula = await loadModule()

  assert.equal(sula.SOURCE, 'sulavineyards')
  assert.equal(sula.COMPANY, 'Sula Vineyards')
  assert.equal(sula.OFFICIAL_BRAND_NAME, 'Sula Vineyards Limited')
  assert.equal(sula.VERIFIED_ON, '2026-08-05')
  assert.equal(sula.CAREERS_PAGE_URL, 'https://sulavineyards.com/careers.php')
  assert.equal(
    sula.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://app.hrone.cloud/career-portal?appId=MHZzWpATk5uSVkWo1EwlhxzjgIG1VZ3pIZYpNVctJxMlUQo18qUoCm-17Y6BMlv4l0Cqdw6PNgHEZKAACmWo7upw3Rwo24m2v5XmXqZ2XGYc1Q2nq54JyLnImKiiIoss&dc=sula&rqt=m8jH4bpBQbccEU8MZpSP5Q&cc=eaqzS8e-weZZc3W_dw_T1Q',
  )
  assert.match(sula.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(sula.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    sula.extractOfficialHROneHandoffUrl(OFFICIAL_CAREERS_HTML),
    'https://app.hrone.cloud/career-portal?appId=MHZzWpATk5uSVkWo1EwlhxzjgIG1VZ3pIZYpNVctJxMlUQo18qUoCm-17Y6BMlv4l0Cqdw6PNgHEZKAACmWo7upw3Rwo24m2v5XmXqZ2XGYc1Q2nq54JyLnImKiiIoss&dc=sula&rqt=m8jH4bpBQbccEU8MZpSP5Q&cc=eaqzS8e-weZZc3W_dw_T1Q',
  )
  assert.equal(sula.pageExposesPublicJobListings(OFFICIAL_CAREERS_HTML), false)
  assert.equal(sula.pageExposesPublicJobListings(HRONE_JS_STUB_HTML), false)
  assert.equal(sula.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    sula.matchesVerifiedOpaqueHROneState({
      status: 200,
      url: sula.OFFICIAL_CAREERS_HANDOFF_URL,
      html: HRONE_JS_STUB_HTML,
    }),
    true,
  )
})

test('Sula Vineyards returns [] only while the verified careers page still hands off to the opaque HROne shell', async () => {
  const sula = await loadModule()
  const requestedUrls = []

  const jobs = await sula.createSulaVineyardsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sula.CAREERS_PAGE_URL) {
        return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
      }

      if (url === sula.OFFICIAL_CAREERS_HANDOFF_URL) {
        return { status: 200, url, html: HRONE_JS_STUB_HTML }
      }

      throw new Error(`Unexpected Sula Vineyards URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sula.CAREERS_PAGE_URL,
    sula.OFFICIAL_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Sula Vineyards default fetch path uses bounded abort signals for each page request', async () => {
  const sula = await loadModule()
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  const requestedUrls = []
  const timeoutMs = []
  const timeoutSignals = []

  AbortSignal.timeout = (ms) => {
    timeoutMs.push(ms)
    const signal = new AbortController().signal
    timeoutSignals.push(signal)
    return signal
  }

  globalThis.fetch = async (url, options = {}) => {
    requestedUrls.push(url)
    const expectedSignal = timeoutSignals.at(-1)

    assert.ok(expectedSignal, 'expected default fetch to request a timeout signal')
    assert.equal(options.signal, expectedSignal)

    if (url === sula.CAREERS_PAGE_URL) {
      return { status: 200, url, text: async () => OFFICIAL_CAREERS_HTML }
    }

    if (url === sula.OFFICIAL_CAREERS_HANDOFF_URL) {
      return { status: 200, url, text: async () => HRONE_JS_STUB_HTML }
    }

    throw new Error(`Unexpected Sula Vineyards URL: ${url}`)
  }

  try {
    const jobs = await sula.createSulaVineyardsScraper().run()

    assert.deepEqual(requestedUrls, [
      sula.CAREERS_PAGE_URL,
      sula.OFFICIAL_CAREERS_HANDOFF_URL,
    ])
    assert.deepEqual(timeoutMs, [15000, 15000])
    assert.deepEqual(jobs, [])
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
})

test('Sula Vineyards fails closed when the verified careers page or HROne handoff drifts materially', async () => {
  const sula = await loadModule()

  await assert.rejects(
    sula.createSulaVineyardsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified sula vineyards careers page/i,
  )

  await assert.rejects(
    sula.createSulaVineyardsScraper().run({
      fetchPage: async (url) => {
        if (url === sula.CAREERS_PAGE_URL) {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
    }),
    /hrone handoff state changed materially|appears to expose public jobs/i,
  )
})
