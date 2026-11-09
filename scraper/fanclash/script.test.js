import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NOT_FOUND_ROUTE_URLS,
  PARKED_HOMEPAGE_URLS,
  UNRESOLVED_DOMAIN_URLS,
  createFanclashScraper,
  hasDnsResolutionFailure,
  hasVerified404Route,
  hasVerifiedAtomParkedRedirect,
} from './script.js'

const parkedPage = {
  status: 403,
  finalUrl: 'https://www.atom.com/name/FanClash',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Just a moment...</title>
        <meta name="robots" content="noindex,nofollow">
      </head>
      <body>
        <h1>Just a moment...</h1>
      </body>
    </html>
  `,
}

const notFoundPage = {
  status: 404,
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>404</title></head>
      <body>
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/">Home</a>
      </body>
    </html>
  `,
}

test('Fanclash accepts the current Atom redirect guarded by a Cloudflare interstitial', () => {
  assert.equal(hasVerifiedAtomParkedRedirect(parkedPage), true)
})

test('Fanclash accepts the current lightweight 404 pages on jobs and crawl routes', () => {
  assert.equal(hasVerified404Route({ ...notFoundPage, finalUrl: NOT_FOUND_ROUTE_URLS[0] }, NOT_FOUND_ROUTE_URLS[0]), true)
  assert.equal(hasDnsResolutionFailure('getaddrinfo ENOTFOUND fanclash.in'), true)
})

test('Fanclash returns no jobs when the parked domain, 404 routes, and unresolved domains still match', async () => {
  const requestedUrls = []
  const jobs = await createFanclashScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (PARKED_HOMEPAGE_URLS.includes(url)) {
        return { ...parkedPage, url }
      }

      if (NOT_FOUND_ROUTE_URLS.includes(url)) {
        return { ...notFoundPage, finalUrl: url, url }
      }

      if (UNRESOLVED_DOMAIN_URLS.includes(url)) {
        return {
          status: 'DNS_ERROR',
          url,
          finalUrl: '',
          html: '',
          errorMessage: 'getaddrinfo ENOTFOUND fanclash.in',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(requestedUrls.length, PARKED_HOMEPAGE_URLS.length + NOT_FOUND_ROUTE_URLS.length + UNRESOLVED_DOMAIN_URLS.length)
})
