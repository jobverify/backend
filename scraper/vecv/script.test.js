import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createVecvScraper,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isBlockedOrMissingCareersRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Just a moment...</title>
    </head>
    <body>
      <h1>Just a moment...</h1>
      <p>Enable JavaScript and cookies to continue</p>
    </body>
  </html>
`

const careersForbiddenRoute = {
  status: 403,
  url: 'https://www.vecv.in/careers',
  html: '<html><body><h1>403 Forbidden</h1></body></html>',
}

const publicJobsRoute = {
  status: 200,
  url: 'https://www.vecv.in/careers',
  html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
}

test('VECV sentinel stays pinned to the official homepage and careers routes', () => {
  assert.equal(SOURCE, 'vecv')
  assert.equal(COMPANY, 'VE Commercial Vehicles')
  assert.equal(HOMEPAGE_URL, 'https://www.vecv.in/')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://www.vecv.in/careers',
    'https://www.vecv.in/careers/',
  ])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasPublicJobsSignal(publicJobsRoute.html), true)
})

test('isBlockedOrMissingCareersRoute accepts the current blocked official careers route but rejects public job pages', () => {
  assert.equal(isBlockedOrMissingCareersRoute(careersForbiddenRoute), true)
  assert.equal(isBlockedOrMissingCareersRoute(publicJobsRoute), false)
})

test('run returns an empty list only when the official VECV careers routes stay blocked or non-public', async () => {
  const requestedUrls = []
  const scraper = createVecvScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return {
          status: 403,
          url: HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      return {
        ...careersForbiddenRoute,
        url,
      }
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})
