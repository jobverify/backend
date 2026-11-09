import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALTERNATE_ROUTE_URLS,
  CAREERS_URL,
  HOMEPAGE_URL,
  LEGACY_HOMEPAGE_URL,
  createFinoPaymentsBankScraper,
  extractHomepageCareerUrl,
  hasOfficialHomepageSignal,
  hasVerifiedNonListingCareersPageSignal,
  isVerifiedAlternateRoute404,
  isExpectedVerificationFailure,
} from './script.js'

const legacyRenegotiationError = new Error(
  'fetch failed | FC1A0200:error:0A000152:SSL routines:final_renegotiate:unsafe legacy renegotiation disabled:openssl\\ssl\\statem\\extensions.c:894:',
)

const powershellReceiveError = new Error(
  'The underlying connection was closed: An unexpected error occurred on a receive.',
)

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <a href="/company/careers">Careers</a>
      <p>Open your FinoPay Account now</p>
      <p>FinoPay</p>
      <p>Savings Account</p>
      <p>Investor Relations</p>
      <p>About Us</p>
      <p>Careers</p>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>We Empower Our People to Shape the Future of Digital Banking</h1>
      <p>Open Roles</p>
      <p>Search by role</p>
      <p>Select Location</p>
      <p>Select Department</p>
      <p>No Roles Found</p>
      <p>Get In Touch</p>
    </body>
  </html>
`

const route404Html = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>404</h1>
      <p>Page not found</p>
    </body>
  </html>
`

test('Fino Payments Bank recognizes the current TLS transport failures from Node and PowerShell', () => {
  assert.equal(isExpectedVerificationFailure(legacyRenegotiationError), true)
  assert.equal(isExpectedVerificationFailure(powershellReceiveError), true)
})

test('Fino Payments Bank accepts a legacy finobank.com transport failure when the current first-party homepage and careers routes still validate', async () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(extractHomepageCareerUrl(homepageHtml), CAREERS_URL)
  assert.equal(hasVerifiedNonListingCareersPageSignal(careersHtml), true)
  assert.equal(
    isVerifiedAlternateRoute404({ status: 404, url: ALTERNATE_ROUTE_URLS[0], html: route404Html }, ALTERNATE_ROUTE_URLS[0]),
    true,
  )

  const requestedUrls = []
  const jobs = await createFinoPaymentsBankScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === LEGACY_HOMEPAGE_URL) {
        throw legacyRenegotiationError
      }

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (ALTERNATE_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: route404Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LEGACY_HOMEPAGE_URL,
    HOMEPAGE_URL,
    CAREERS_URL,
    ...ALTERNATE_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fino Payments Bank returns [] when every verified first-party surface fails with the same expected TLS transport issue', async () => {
  const requestedUrls = []

  const jobs = await createFinoPaymentsBankScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      throw legacyRenegotiationError
    },
  })

  assert.deepEqual(requestedUrls, [
    LEGACY_HOMEPAGE_URL,
    HOMEPAGE_URL,
    CAREERS_URL,
    ...ALTERNATE_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
