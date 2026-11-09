import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createProventechScraper,
  hasVerifiedLoginShellSignal,
  isExpectedMissingCareerRoute,
} from './script.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ProvenTech</title>
  </head>
  <body>
    <main>
      <p>Powered by ProvenTech</p>
      <p>ProvenTech Human Resource Management System allows employees to access HR-related information.</p>
      <button>Login</button>
      <a href="/forgot-password">Forgot Password?</a>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found at /careers</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

test('Proventech sentinel stays pinned to the verified HRMS login shell and missing public careers routes', () => {
  assert.equal(SOURCE, 'proventech')
  assert.equal(COMPANY, 'Proventech')
  assert.equal(HOMEPAGE_URL, 'https://hr.proventech.in/')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://hr.proventech.in/careers',
    'https://hr.proventech.in/jobs',
  ])
  assert.equal(hasVerifiedLoginShellSignal(homepageHtml), true)
  assert.equal(
    isExpectedMissingCareerRoute({
      status: 404,
      url: CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Proventech returns [] only while the verified login shell and missing careers routes remain unchanged', async () => {
  const requestedUrls = []

  const jobs = await createProventechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: url.endsWith('/jobs')
            ? missingRouteHtml.replace('/careers', '/jobs')
            : missingRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})
