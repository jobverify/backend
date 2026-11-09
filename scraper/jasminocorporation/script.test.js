import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  createJasminoCorporationScraper,
  hasOfficialHomepageSignal,
  isVerifiedMissingRouteError,
} from './script.js'

const officialHomepageHtml = `
  <html lang="en">
    <head>
      <title>Industrial Process Equipment | Anticorrosive Linings | Surface Protection</title>
    </head>
    <body>
      <main>
        <h1>Jasmino Corporation</h1>
        <p>With over 40 years of engineering excellence, Jasmino is an industry leader in Industrial process equipment engineering, Anticorrosive Linings, and Surface Protection.</p>
        <a href="/contact">Contact Us</a>
      </main>
    </body>
  </html>
`

test('Jasmino Corporation scraper recognizes the verified official homepage and missing-route errors', () => {
  assert.equal(COMPANY, 'Jasmino Corporation')
  assert.equal(HOMEPAGE_URL, 'https://jasmino.com/')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://jasmino.com/careers',
    'https://jasmino.com/careers/',
    'https://jasmino.com/career',
    'https://jasmino.com/career/',
    'https://jasmino.com/jobs',
    'https://jasmino.com/jobs/',
  ])
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><head><title>Placeholder</title></head><body></body></html>'), false)
  assert.equal(isVerifiedMissingRouteError(new Error(`HTTP 404 for ${CAREERS_ROUTE_URLS[0]}`), CAREERS_ROUTE_URLS[0]), true)
  assert.equal(isVerifiedMissingRouteError(new Error(`HTTP 500 for ${CAREERS_ROUTE_URLS[0]}`), CAREERS_ROUTE_URLS[0]), false)
})

test('run returns no jobs when Jasmino Corporation only exposes the verified official homepage and missing careers routes', async () => {
  const requestedUrls = []
  const jobs = await createJasminoCorporationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return officialHomepageHtml
      }

      if (CAREERS_ROUTE_URLS.includes(url)) {
        throw new Error(`HTTP 404 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the Jasmino Corporation homepage no longer matches the verified official surface', async () => {
  await assert.rejects(
    createJasminoCorporationScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>Coming soon</body></html>',
    }),
    /Jasmino Corporation homepage no longer matches the verified official site/i,
  )
})

test('run fails closed when a previously missing Jasmino Corporation route starts resolving publicly', async () => {
  await assert.rejects(
    createJasminoCorporationScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return officialHomepageHtml
        }

        if (url === CAREERS_ROUTE_URLS[0]) {
          return '<html><head><title>Careers</title></head><body><h1>Careers</h1></body></html>'
        }

        if (CAREERS_ROUTE_URLS.includes(url)) {
          throw new Error(`HTTP 404 for ${url}`)
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Jasmino Corporation careers routes no longer match the verified public missing-route surface/i,
  )
})
