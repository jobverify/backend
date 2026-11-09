import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHECKED_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  LANDER_URL,
  SOURCE,
  createBigChillarTechnologiesPvtLtdScraper,
  extractRedirectTarget,
  hasParkedLanderSignal,
  hasPublicJobsSignal,
  hasRedirectShellSignal,
} from './script.js'

const redirectShellHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>window.onload=function(){window.location.href="/lander"}</script>
    </head>
    <body></body>
  </html>
`

const parkedLanderHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
      <script>window.LANDER_SYSTEM="PW"</script>
      <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
      <script>window._signalsDataLayer=window._signalsDataLayer||[]</script>
      <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
      <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.98fc5cd3.js"></script>
      <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <a href="/jobs/software-engineer">Apply now</a>
    </body>
  </html>
`

test('BigChillar Technologies Pvt.Ltd sentinel stays pinned to the verified redirect shell and parked lander surface', () => {
  assert.equal(SOURCE, 'bigchillartechnologiespvtltd')
  assert.equal(COMPANY, 'BigChillar Technologies Pvt.Ltd')
  assert.equal(HOMEPAGE_URL, 'https://bigchillar.com/')
  assert.equal(LANDER_URL, 'https://bigchillar.com/lander')
  assert.deepEqual(CHECKED_ROUTE_URLS, [
    'https://bigchillar.com/careers',
    'https://bigchillar.com/careers/',
    'https://bigchillar.com/career',
    'https://bigchillar.com/career/',
    'https://bigchillar.com/jobs',
    'https://bigchillar.com/jobs/',
    'https://bigchillar.com/join-us',
    'https://bigchillar.com/join-us/',
    'https://bigchillar.com/about',
    'https://bigchillar.com/contact',
  ])
  assert.equal(hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(hasParkedLanderSignal(parkedLanderHtml), true)
  assert.equal(hasPublicJobsSignal(redirectShellHtml), false)
  assert.equal(hasPublicJobsSignal(parkedLanderHtml), false)
  assert.equal(hasPublicJobsSignal(publicJobsHtml), true)
})

test('BigChillar Technologies Pvt.Ltd sentinel returns [] only while the verified first-party shell remains parked', async () => {
  const requestedUrls = []
  const scraper = createBigChillarTechnologiesPvtLtdScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL || CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: redirectShellHtml,
        }
      }

      if (url === LANDER_URL) {
        return {
          status: 200,
          url,
          html: parkedLanderHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CHECKED_ROUTE_URLS, LANDER_URL])
  assert.deepEqual(jobs, [])
})

test('BigChillar Technologies Pvt.Ltd sentinel fails closed when the redirect shell or parked lander drifts into a jobs surface', async () => {
  await assert.rejects(
    createBigChillarTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>BigChillar Technologies</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /redirect shell no longer matches/i,
  )

  await assert.rejects(
    createBigChillarTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL || CHECKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
          }
        }

        if (url === LANDER_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /parked lander surface changed or now exposes public jobs/i,
  )

  await assert.rejects(
    createBigChillarTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
          }
        }

        if (url === CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        if (CHECKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
          }
        }

        if (url === LANDER_URL) {
          return {
            status: 200,
            url,
            html: parkedLanderHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked first-party route changed/i,
  )
})
