import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CAREERS_ROUTE_URL,
  JOBS_ROUTE_URL,
  create3EdgeScraper,
  hasCareersSignal,
  hasOfficialSiteSignal,
  isMissingCareerRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>3Edge Technologies: When it comes down to IT</title>
    </head>
    <body>
      <h1>3Edge Technologies</h1>
      <p>Consultancy, development and maintenance services.</p>
    </body>
  </html>
`

const notFoundHtml = `
  <html>
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <h1>Not Found</h1>
    </body>
  </html>
`

test('site signal helpers detect the official homepage and missing career routes', () => {
  assert.equal(hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(hasCareersSignal(homepageHtml), false)
  assert.equal(isMissingCareerRoute(notFoundHtml), true)
})

test('legacy homepage discovery returns no projected jobs without reading guessed career routes', async () => {
  const requestedUrls = []
  const jobs = await create3EdgeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) return homepageHtml
      if (url === CAREERS_ROUTE_URL || url === JOBS_ROUTE_URL) return notFoundHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
