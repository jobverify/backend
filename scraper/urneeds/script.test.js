import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHECKED_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  LANDER_URL,
  SOURCE,
  createUrneedsScraper,
  extractRedirectTarget,
  hasParkedLanderSignal,
  hasPublicJobsSignal,
  hasRedirectShellSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <script>window.onload=function(){window.location.href="/lander"}</script>
    </head>
    <body></body>
  </html>
`

const landerHtml = `
  <html>
    <head>
      <script>window.LANDER_SYSTEM="PW"</script>
      <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
      <script>window._signalsDataLayer=window._signalsDataLayer||[]</script>
      <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.351f5916.js"></script>
      <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

test('Urneeds sentinel stays pinned to the verified redirect shell and parked lander surface', () => {
  assert.equal(SOURCE, 'urneeds')
  assert.equal(COMPANY, 'Urneeds')
  assert.equal(HOMEPAGE_URL, 'https://www.urneeds.in/')
  assert.equal(LANDER_URL, 'https://www.urneeds.in/lander')
  assert.deepEqual(CHECKED_ROUTE_URLS, [
    'https://www.urneeds.in/careers',
    'https://www.urneeds.in/career',
    'https://www.urneeds.in/jobs',
    'https://www.urneeds.in/join-us',
  ])
  assert.equal(hasRedirectShellSignal(homepageHtml), true)
  assert.equal(extractRedirectTarget(homepageHtml), '/lander')
  assert.equal(hasParkedLanderSignal(landerHtml), true)
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(landerHtml), false)
})

test('run returns no jobs only while Urneeds remains a parked first-party shell', async () => {
  const requestedUrls = []
  const scraper = createUrneedsScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL || CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === LANDER_URL) {
        return {
          status: 200,
          url,
          html: landerHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CHECKED_ROUTE_URLS, LANDER_URL])
  assert.deepEqual(jobs, [])
})
