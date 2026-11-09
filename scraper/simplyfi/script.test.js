import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  HOMEPAGE_URL,
  NO_PUBLIC_CAREERS_ROUTE_URLS,
  SOURCE,
  createSimplyFiScraper,
  hasFirstPartyCareerLikeLink,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isVerifiedNoPublicJobsRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>simplyfi.tech | simplyfi</title>
    </head>
    <body>
      <h1>Transact With Precision. Streamline Costs. Reduce Risk. Seize Opportunity.</h1>
      <p>For enterprise organizations seeking to optimize their global trade and supply chain operations, SimplyFI is an AI-powered smart process automation platform that delivers precision, efficiency, and regulatory compliance.</p>
      <p>Trade Finance</p>
      <p>SimplyFI BaaS</p>
      <h2>Let us know how we can help</h2>
      <a href="/contact">Contact Us</a>
      <a href="/about">About Us</a>
    </body>
  </html>
`

const notFoundRoute = {
  status: 404,
  url: 'https://www.simplyfi.tech/careers',
  html: '<html><body><h1>404</h1><p>Page not found</p></body></html>',
}

const publicJobsHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <a href="/apply">Apply now</a>
    </body>
  </html>
`

const homepageWithCareerLink = `
  <html>
    <body>
      <a href="/careers">Careers</a>
    </body>
  </html>
`

test('SimplyFI sentinel stays pinned to the official homepage and verified missing careers routes', () => {
  assert.equal(SOURCE, 'simplyfi')
  assert.equal(COMPANY, 'SimplyFI Softech Pvt. Ltd.')
  assert.equal(HOMEPAGE_URL, 'https://www.simplyfi.tech/')
  assert.equal(NO_PUBLIC_CAREERS_ROUTE_URLS.length, 8)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(hasFirstPartyCareerLikeLink(homepageWithCareerLink), true)
  assert.equal(hasPublicJobsSignal(publicJobsHtml), true)
})

test('isVerifiedNoPublicJobsRoute accepts 404 fallbacks but rejects public jobs', () => {
  assert.equal(isVerifiedNoPublicJobsRoute(notFoundRoute), true)
  assert.equal(
    isVerifiedNoPublicJobsRoute({
      status: 200,
      url: HOMEPAGE_URL,
      html: homepageHtml,
    }),
    true,
  )
  assert.equal(
    isVerifiedNoPublicJobsRoute({
      status: 200,
      url: 'https://www.simplyfi.tech/jobs',
      html: publicJobsHtml,
    }),
    false,
  )
})

test('run returns an empty list only when SimplyFI exposes no public careers surface on common routes', async () => {
  const requestedUrls = []
  const scraper = createSimplyFiScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return {
          status: 200,
          url: HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      return {
        ...notFoundRoute,
        url,
      }
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...NO_PUBLIC_CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})
