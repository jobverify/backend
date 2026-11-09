import assert from 'node:assert/strict'
import test from 'node:test'

const stackboxModule = await import('../../scraper/stackbox/script.js').catch(() => ({}))

const {
  BROKEN_ROUTE_URL,
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  HOMEPAGE_URL,
  NOT_FOUND_CANONICAL_URL,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createStackboxScraper,
  hasVerifiedHomepage,
  isVerifiedBrokenCompanyRoute,
  run,
} = stackboxModule

const VERIFIED_HOMEPAGE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Stackbox | Cloud WMS, TMS, OMS &amp; Route-to-Market Platform - India</title>
      <link rel="canonical" href="https://www.stackbox.xyz" />
    </head>
    <body>
      <main>
        <h1>Stackbox</h1>
        <p>Lead the Next Fulfilment Era</p>
        <p>We are the premier supply chain SaaS partners for growing enterprises.</p>
        <a href="/resources/about-us">About us</a>
      </main>
    </body>
  </html>
`

const VERIFIED_BROKEN_ROUTE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Stackbox</title>
      <link rel="canonical" href="${NOT_FOUND_CANONICAL_URL}" />
    </head>
    <body>
      <main>
        <div>404</div>
        <h1>Page Not Found</h1>
        <p>The page you are looking for doesn't exist or has been moved</p>
        <a href="/">Back to Home</a>
      </main>
    </body>
  </html>
`

test('Stackbox validates the homepage and the branded broken company route', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) {
        return {
          status: 200,
          url: HOMEPAGE_URL,
          html: VERIFIED_HOMEPAGE_HTML,
        }
      }

      if (url === CAREERS_URL) {
        return {
          status: 404,
          url: BROKEN_ROUTE_URL,
          html: VERIFIED_BROKEN_ROUTE_HTML,
        }
      }

      assert.fail(`Unexpected fetchPage URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'stackbox')
  assert.equal(COMPANY, 'Stackbox')
  assert.equal(DISPOSITION, 'verified-homepage-with-broken-company-route-sentinel')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.match(VERIFIED_SURFACE_SUMMARY, /untitled\/about-us/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /canonical https:\/\/www\.stackbox\.xyz\/404/i)
  assert.equal(typeof createStackboxScraper, 'function')
  assert.equal(hasVerifiedHomepage(VERIFIED_HOMEPAGE_HTML), true)
  assert.equal(
    isVerifiedBrokenCompanyRoute({
      status: 404,
      url: BROKEN_ROUTE_URL,
      html: VERIFIED_BROKEN_ROUTE_HTML,
    }),
    true,
  )
})

test('Stackbox rejects when the verified homepage disappears', async () => {
  assert.equal(
    hasVerifiedHomepage(`
      <html>
        <head><title>Example</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><head><title>Example</title></head><body><h1>Example</h1></body></html>',
      }),
    }),
    /verified homepage/i,
  )
})

test('Stackbox rejects when the broken company route no longer resolves to the branded 404 surface', async () => {
  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: VERIFIED_HOMEPAGE_HTML,
          }
        }

        return {
          status: 200,
          url: 'https://www.stackbox.xyz/resources/about-us',
          html: `
            <html>
              <head><title>About Us | Stackbox</title></head>
              <body><h1>About us</h1></body>
            </html>
          `,
        }
      },
    }),
    /branded 404 surface/i,
  )
})

test('Stackbox still supports fetchHtml-based unit injection for the homepage plus broken route sentinel', async () => {
  const jobs = await run({
    fetchHtml: async (url) => {
      if (url === HOMEPAGE_URL) return VERIFIED_HOMEPAGE_HTML
      if (url === CAREERS_URL) return VERIFIED_BROKEN_ROUTE_HTML
      assert.fail(`Unexpected fetchHtml URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
