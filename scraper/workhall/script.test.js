import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  VERIFIED_AT,
  createWorkhallScraper,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isVerifiedNoPublicJobsRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Workhall | AI-driven no-code business process platform</title>
      <meta property="og:url" content="https://workhall.co/">
    </head>
    <body>
      <header>
        <a href="https://workhall.co/">workhall.co</a>
      </header>
      <main>
        <h1>Workhall</h1>
        <p>Automate work with a no-code process orchestration platform.</p>
      </main>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head>
      <title>Work Hall - Private Offices &amp; Co-working Space</title>
    </head>
    <body>
      <main>
        <h1>re think your workspace</h1>
        <p>We create spaces for people to do their life's best work with the backing of a robust community.</p>
        <a href="/book-space">BOOK MY SPACE</a>
        <a href="/book-tour">BOOK MY TOUR</a>
      </main>
    </body>
  </html>
`

const notFoundRoute = {
  status: 404,
  url: 'https://workhall.co/careers',
  html: '<html><body><h1>404</h1><p>Page not found</p></body></html>',
}

const redirectedHomepageRoute = {
  status: 200,
  url: 'https://workhall.co/',
  html: homepageHtml,
}

const publicJobsRoute = {
  status: 200,
  url: 'https://workhall.co/careers',
  html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
}

const cloudflare522Route = {
  status: 522,
  url: 'https://workhall.co/careers',
  html: `
    <html>
      <head><title>workhall.co | 522: Connection timed out</title></head>
      <body>
        <h1>522: Connection timed out</h1>
        <span>Error code 522</span>
        <p>Cloudflare Working</p>
        <p>Host Error</p>
        <p>Connection timed out</p>
      </body>
    </html>
  `,
}

test('Workhall sentinel stays pinned to the official homepage and common careers routes', () => {
  assert.equal(SOURCE, 'workhall')
  assert.equal(COMPANY, 'Workhall Pvt Ltd')
  assert.equal(VERIFIED_AT, '2026-08-13')
  assert.equal(HOMEPAGE_URL, 'https://workhall.co/')
  assert.equal(CAREERS_ROUTE_URLS.length, 8)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasPublicJobsSignal(publicJobsRoute.html), true)
})

test('isVerifiedNoPublicJobsRoute accepts 404s and homepage redirects but rejects public job pages', () => {
  assert.equal(isVerifiedNoPublicJobsRoute(notFoundRoute), true)
  assert.equal(isVerifiedNoPublicJobsRoute(redirectedHomepageRoute), true)
  assert.equal(isVerifiedNoPublicJobsRoute(cloudflare522Route), true)
  assert.equal(isVerifiedNoPublicJobsRoute(publicJobsRoute), false)
})

test('run returns an empty list only when Workhall exposes no public careers surface on common routes', async () => {
  const requestedUrls = []
  const scraper = createWorkhallScraper()

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

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})

test('Workhall recognizes the current coworking homepage shell as the official no-public-jobs surface', () => {
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('Workhall returns [] when the current verified first-party routes serve Cloudflare 522 timeout pages', async () => {
  const requestedUrls = []
  const scraper = createWorkhallScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        ...cloudflare522Route,
        url,
      }
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})
