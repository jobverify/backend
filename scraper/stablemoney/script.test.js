import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  NO_PUBLIC_JOBS_ROUTE_URLS,
  OFFICIAL_FIRST_PARTY_ROUTE_URLS,
  SOURCE,
  createStableMoneyScraper,
  hasExpectedOfficialFirstPartySignal,
  isUnexpectedPublicJobsSurface,
} from './script.js'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Stable Money - Earn Up to 8.50% with High-Yield Fixed Deposits</title>
  </head>
  <body>
    <h1>Stable Money</h1>
    <p>India's top FD rates with trusted Fixed Deposits.</p>
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
    <h1>About Stable Money</h1>
    <p>Stable-Alpha Technologies Private Limited operates the Stable Money platform.</p>
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
    <h1>Contact Us</h1>
    <p>Connect with the Stable Money Team at help@stablemoney.in.</p>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html>
  <head><title>404</title></head>
  <body><h1>Page not found</h1></body>
</html>
`

const officialSurfaceByUrl = new Map([
  ['https://stablemoney.in/', homepageHtml],
  ['https://stablemoney.in/about-us', aboutHtml],
  ['https://stablemoney.in/contact-us', contactHtml],
])

test('Stable Money sentinel recognizes the current official first-party pages and adjacent no-jobs routes', async () => {
  assert.equal(SOURCE, 'stablemoney')
  assert.equal(COMPANY, 'Stable Money')
  assert.deepEqual(OFFICIAL_FIRST_PARTY_ROUTE_URLS, [
    'https://stablemoney.in/',
    'https://stablemoney.in/about-us',
    'https://stablemoney.in/contact-us',
  ])

  for (const [url, html] of officialSurfaceByUrl) {
    const surface = { url, finalUrl: url, status: 200, html, errorKind: null }
    assert.equal(hasExpectedOfficialFirstPartySignal(surface), true)
    assert.equal(isUnexpectedPublicJobsSurface(surface), false)
  }

  const requestedUrls = []
  const jobs = await createStableMoneyScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (officialSurfaceByUrl.has(url)) {
        return {
          url,
          finalUrl: url,
          status: 200,
          html: officialSurfaceByUrl.get(url),
          errorKind: null,
        }
      }

      if (NO_PUBLIC_JOBS_ROUTE_URLS.includes(url)) {
        return {
          url,
          finalUrl: url,
          status: 404,
          html: notFoundHtml,
          errorKind: null,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...OFFICIAL_FIRST_PARTY_ROUTE_URLS,
    ...NO_PUBLIC_JOBS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Stable Money marks official first-party transport outages as upstream soft failures instead of surface drift', async () => {
  await assert.rejects(
    createStableMoneyScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://stablemoney.in/') {
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
    }),
    (error) => {
      assert.match(error.message, /temporarily unavailable|timeout/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.abortRetries, true)
      assert.equal(error.failureKind, 'network_or_timeout')
      return true
    },
  )
})
