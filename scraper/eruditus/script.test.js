import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHECKED_404_ROUTE_URLS,
  HOMEPAGE_URL,
  PAGE_SITEMAP_URL,
  ROBOTS_TXT_URL,
  createEruditusScraper,
  hasExpectedNotFoundSurface,
  hasHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eruditus Executive Education</title>
      <link rel="canonical" href="https://eruditus.com/">
      <meta
        name="description"
        content="Eruditus Executive Education offers the best executive education programmes for professionals."
      >
    </head>
    <body>
      <nav>
        <a href="/about-us/">About Us</a>
        <a href="/newsroom/">Newsroom</a>
      </nav>
      <main>
        <h1>Learn. From the world’s best.</h1>
        <p>Eruditus was founded in 2010</p>
      </main>
    </body>
  </html>
`

const robotsTxt = `
  User-agent: *
  Sitemap: https://eruditus.com/sitemap_index.xml
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset>
    <url><loc>https://eruditus.com/about-us/</loc></url>
    <url><loc>https://eruditus.com/newsroom/</loc></url>
  </urlset>
`

const blockedCareersRoute = {
  status: 403,
  html: `
    <html>
      <head><title>403 Forbidden</title></head>
      <body>
        <center><h1>403 Forbidden</h1></center>
        <hr>
        <center>nginx</center>
      </body>
    </html>
  `,
}

test('homepage signal accepts the current Eruditus marketing copy without a contact-us token', () => {
  assert.equal(hasHomepageSignal(homepageHtml), true)
})

test('blocked careers routes accept the current 403 nginx surface', () => {
  assert.equal(hasExpectedNotFoundSurface(blockedCareersRoute), true)
})

test('scraper returns no jobs when the verified public surface exposes no careers route', async () => {
  const requestedUrls = []
  const scraper = createEruditusScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, html: homepageHtml, url }
      }

      if (url === ROBOTS_TXT_URL) {
        return { status: 200, html: robotsTxt, url }
      }

      if (url === PAGE_SITEMAP_URL) {
        return { status: 200, html: pageSitemapXml, url }
      }

      if (CHECKED_404_ROUTE_URLS.includes(url)) {
        return { ...blockedCareersRoute, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    ROBOTS_TXT_URL,
    PAGE_SITEMAP_URL,
    ...CHECKED_404_ROUTE_URLS,
  ])
})
