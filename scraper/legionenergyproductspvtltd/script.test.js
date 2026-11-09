import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  MISSING_ROUTE_URLS,
  createLegionEnergyProductsScraper,
  hasOfficialHomepageSignal,
  hasVerifiedCareersLink,
  isVerifiedServerTimeoutPage,
} from './script.js'

const HOMEPAGE_HTML = `<!DOCTYPE html>
<html>
<head><title>Legion Energy - Powering What Matters</title></head>
<body>
  <section>Powering What Matters</section>
  <section>Founded in 2007 in Bangalore</section>
  <section>Electrical Power and Telecom Networks Industries</section>
  <a href="https://legionenergy.in/careers/">Careers</a>
</body>
</html>`

const TIMEOUT_HTML = `<!DOCTYPE html>
<html>
<head><title>408 Request Time-out</title></head>
<body>
  <h1>408 Request Time-out</h1>
  <p>This request takes too long to process, it is timed out by the server.</p>
  <p>If it should not be timed out, please contact administrator of this web site to increase 'Connection Timeout'.</p>
</body>
</html>`

test('Legion Energy homepage still verifies the official careers handoff', () => {
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasVerifiedCareersLink(HOMEPAGE_HTML), true)
})

test('Legion Energy recognizes the current first-party 408 timeout shell', () => {
  assert.equal(isVerifiedServerTimeoutPage({
    status: 408,
    url: CAREERS_URL,
    html: TIMEOUT_HTML,
  }), true)
})

test('Legion Energy returns an empty set when careers routes consistently serve the verified 408 shell', async () => {
  const scraper = createLegionEnergyProductsScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: HOMEPAGE_HTML,
        }
      }

      if (url === CAREERS_URL || MISSING_ROUTE_URLS.includes(url)) {
        return {
          status: 408,
          url,
          html: TIMEOUT_HTML,
        }
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
