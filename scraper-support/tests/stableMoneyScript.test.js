import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/stablemoney/script.js')
  } catch {
    assert.fail('Expected Stable Money scraper module at ../../scraper/stablemoney/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Stable Money - Earn Up to 8.30% with High-Yield Fixed Deposits</title>
  </head>
  <body>
    <main>
      <h1>Stable Money</h1>
      <p>Book high-yield fixed deposits from trusted banks.</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html>
  <head>
    <title>About Stable Money | Your Trusted Partner for Bonds, Fixed Deposits &amp; Investments</title>
  </head>
  <body>
    <main>
      <h1>About Stable Money</h1>
      <p>Stable-Alpha Technologies Private Limited operates the Stable Money platform.</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html>
  <head>
    <title>Contact Us | Connect with the Stable Money Team for Queries &amp; Support</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <a href="mailto:help@stablemoney.in">help@stablemoney.in</a>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html>
  <head><title>404: Page Not Found</title></head>
  <body>
    <main>Page not found</main>
    <script>const label = "Apply now for a physical card";</script>
  </body>
</html>
`

test('Stable Money validates reachable official first-party pages and adjacent no-jobs routes', async () => {
  const stablemoney = await loadModule()
  const requestedUrls = []

  assert.equal(stablemoney.SOURCE, 'stablemoney')
  assert.equal(stablemoney.COMPANY, 'Stable Money')
  assert.equal(stablemoney.COMPANY_DOMAIN, 'stablemoney.in')
  assert.equal(stablemoney.VERIFIED_AT, '2026-07-19')
  assert.deepEqual(stablemoney.OFFICIAL_FIRST_PARTY_ROUTE_URLS, [
    'https://stablemoney.in/',
    'https://stablemoney.in/about-us',
    'https://stablemoney.in/contact-us',
  ])
  assert.deepEqual(stablemoney.NO_PUBLIC_JOBS_ROUTE_URLS, [
    'https://stablemoney.in/careers',
    'https://stablemoney.in/career',
    'https://stablemoney.in/jobs',
    'https://stablemoney.in/join-us',
    'https://stablemoney.in/work-with-us',
    'https://stablemoney.in/openings',
  ])

  const jobs = await stablemoney.createStableMoneyScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://stablemoney.in/') {
        return { url, finalUrl: url, status: 200, html: homepageHtml, errorKind: null }
      }
      if (url === 'https://stablemoney.in/about-us') {
        return { url, finalUrl: url, status: 200, html: aboutHtml, errorKind: null }
      }
      if (url === 'https://stablemoney.in/contact-us') {
        return { url, finalUrl: url, status: 200, html: contactHtml, errorKind: null }
      }

      return { url, finalUrl: url, status: 404, html: notFoundHtml, errorKind: null }
    },
  })

  assert.deepEqual(requestedUrls, [
    ...stablemoney.OFFICIAL_FIRST_PARTY_ROUTE_URLS,
    ...stablemoney.NO_PUBLIC_JOBS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Stable Money ignores consumer apply copy in app bundles but fails closed on real public job links', async () => {
  const stablemoney = await loadModule()
  const officialHtmlByUrl = new Map([
    ['https://stablemoney.in/', homepageHtml],
    ['https://stablemoney.in/about-us', aboutHtml],
    ['https://stablemoney.in/contact-us', contactHtml],
  ])

  assert.equal(
    stablemoney.isUnexpectedPublicJobsSurface({
      status: 404,
      html: notFoundHtml,
    }),
    false,
  )
  assert.equal(
    stablemoney.isUnexpectedPublicJobsSurface({
      status: 200,
      html: '<main><h1>Open Positions</h1><a href="https://jobs.lever.co/stablemoney/backend-engineer">Backend Engineer</a></main>',
    }),
    true,
  )

  await assert.rejects(
    stablemoney.createStableMoneyScraper().run({
      probeUrl: async (url) => {
        if (stablemoney.OFFICIAL_FIRST_PARTY_ROUTE_URLS.includes(url)) {
          return { url, finalUrl: url, status: 200, html: officialHtmlByUrl.get(url), errorKind: null }
        }

        return {
          url,
          finalUrl: url,
          status: 200,
          html: '<main><h1>Open Positions</h1><a href="https://jobs.lever.co/stablemoney/backend-engineer">Backend Engineer</a></main>',
          errorKind: null,
        }
      },
    }),
    /public jobs surface/i,
  )
})

test('Stable Money default probe keeps the timeout active until the response body is consumed', async () => {
  const stablemoney = await loadModule()
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const events = []

  globalThis.setTimeout = (callback, timeoutMs) => {
    events.push(['setTimeout', timeoutMs, typeof callback])
    return { timeoutMs }
  }
  globalThis.clearTimeout = () => {
    events.push(['clearTimeout'])
  }
  globalThis.fetch = async (url, options = {}) => {
    events.push(['fetch', url, options.signal instanceof AbortSignal])

    return {
      url,
      status: 200,
      text: async () => {
        events.push(['text', options.signal.aborted])
        return '<html><body>No public hiring surface here.</body></html>'
      },
    }
  }

  try {
    await assert.rejects(
      stablemoney.createStableMoneyScraper().run(),
      /verified official first-party surface changed/i,
    )
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }

  assert.deepEqual(events.map((event) => event[0]), [
    'setTimeout',
    'fetch',
    'text',
    'clearTimeout',
  ])
  assert.equal(events[0][1], 10000)
  assert.equal(events[0][2], 'function')
  assert.equal(events[2][1], false)
})
