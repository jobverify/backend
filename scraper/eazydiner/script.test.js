import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  MISSING_JOB_ROUTE_URLS,
  OTHER_ROUTES_SITEMAP_URL,
  ROBOTS_URL,
  ROOT_URL,
  SITEMAP_URL,
  createEazyDinerScraper,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Find the Best Restaurants with Great Deals | Eazydiner</title>
    </head>
    <body>
      <a href="https://www.eazydiner.com/career">Career</a>
      <a href="https://www.eazydiner.com/contact-us">Contact Us</a>
      <a href="https://www.eazydiner.com/blogs">Blogs</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Explore Career Opportunities at EazyDiner | Apply Now</title>
      <link rel="canonical" href="https://www.eazydiner.com/career">
    </head>
    <body>
      <h1>Career | EazyDiner</h1>
      <p>Want to join the dining ride?</p>
      <a href="mailto:career@eazydiner.com">career@eazydiner.com</a>
    </body>
  </html>
`

const robotsTxt = `
User-agent: *
Allow: /
Sitemap: https://www.eazydiner.com/sitemap.xml
`

const missingSitemapJson = '{"message":"Sitemap not found"}'

const othersSitemapXml = `
  <urlset>
    <url><loc>https://www.eazydiner.com/career</loc></url>
  </urlset>
`

const missingRouteHtml = `
  <html>
    <head><title>404: This page could not be found.</title></head>
    <body><h1>404</h1><p>This page could not be found.</p></body>
  </html>
`

test('EazyDiner returns [] when the career page is still valid but sitemap.xml is the current 404 placeholder on Thursday, August 13, 2026', async () => {
  const requestedUrls = []

  const jobs = await createEazyDinerScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ROOT_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === ROBOTS_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === SITEMAP_URL) {
        return { status: 404, url, html: missingSitemapJson }
      }

      if (url === OTHER_ROUTES_SITEMAP_URL) {
        return { status: 200, url, html: othersSitemapXml }
      }

      if (MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ROOT_URL,
    CAREERS_URL,
    ROBOTS_URL,
    SITEMAP_URL,
    OTHER_ROUTES_SITEMAP_URL,
    ...MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
