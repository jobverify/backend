import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  HOMEPAGE_URL,
  JOBS_URL,
  LEGACY_CAREERS_URL,
  ROBOTS_TXT_URL,
  SITEMAP_URL,
  US_CAREERS_URL,
  createDripCapitalScraper,
} from './script.js'

const hash = '9999999999'
const buildPayloadUrl = (route) => `https://assets.dripcapital.com/_nuxt/static/${hash}${route}/payload.js`
const buildStateUrl = (route) => `https://assets.dripcapital.com/_nuxt/static/${hash}${route}/state.js`

const homepageHtml = `
  <html>
    <head>
      <title>Trade Finance Simplified | Drip Capital</title>
      <link rel="canonical" href="https://www.dripcapital.com/">
      <meta name="description" content="Drip Capital is a Trade Finance company helping global SMBs.">
    </head>
    <body><div>Home</div></body>
  </html>
`

const legacyCareersHtml = `
  <html>
    <head></head>
    <body>
      <div id="__nuxt"></div>
      <script src="${buildStateUrl('/careers')}"></script>
      <script src="${buildPayloadUrl('/careers')}"></script>
      <div>This website requires JavaScript. Spinning</div>
    </body>
  </html>
`

const indiaCareersHtml = `
  <html>
    <head>
      <title>Careers</title>
      <meta name="description" content="Work at Drip. Join us and be a part of our journey.">
    </head>
    <body>
      <div id="__nuxt"></div>
      <script src="${buildStateUrl('/en-in/careers')}"></script>
      <script src="${buildPayloadUrl('/en-in/careers')}"></script>
      <p>Our mission is to enable growing companies in all corners of the world.</p>
    </body>
  </html>
`

const usCareersHtml = `
  <html>
    <head>
      <title>Careers | Join Drip Capital</title>
      <link rel="canonical" href="https://www.dripcapital.com/en-us/careers/">
      <meta property="og:title" content="Careers | Join Drip Capital">
      <meta name="description" content="Join the Drip Capital team. Build the future of working capital access for SMBs. We are hiring engineers, analysts, and operators.">
    </head>
    <body>
      <div id="__nuxt"></div>
      <script src="${buildStateUrl('/en-us/careers')}"></script>
      <script src="${buildPayloadUrl('/en-us/careers')}"></script>
      <p>This website requires JavaScript.</p>
    </body>
  </html>
`

const robotsTxt = 'User-agent: *\nSitemap: https://www.dripcapital.com/sitemap.xml\n'
const sitemapXml = `
  <urlset>
    <url><loc>https://www.dripcapital.com/en-in/careers/</loc></url>
  </urlset>
`

const jobs404Html = `
  <html>
    <head><title>404 Not Found</title></head>
    <body><p>404 Not Found</p></body>
  </html>
`

test('Drip Capital follows the page-advertised empty Nuxt payload URLs instead of pinning an old static hash', async () => {
  const requestedUrls = []

  const jobs = await createDripCapitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === LEGACY_CAREERS_URL) return { status: 200, url, html: legacyCareersHtml }
      if (url === CAREERS_PAGE_URL) return { status: 200, url, html: indiaCareersHtml }
      if (url === US_CAREERS_URL) return { status: 200, url, html: usCareersHtml }
      if (url === buildPayloadUrl('/careers')) return { status: 200, url, html: '__NUXT_JSONP__("/careers", {data:[{}],fetch:{},mutations:[]});' }
      if (url === buildPayloadUrl('/en-in/careers')) return { status: 200, url, html: '__NUXT_JSONP__("/en-in/careers", {data:[{}],fetch:{},mutations:[]});' }
      if (url === buildPayloadUrl('/en-us/careers')) return { status: 200, url, html: '__NUXT_JSONP__("/en-us/careers", {data:[{}],fetch:{},mutations:[]});' }
      if (url === JOBS_URL) return { status: 404, url, html: jobs404Html }
      if (url === ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
      if (url === SITEMAP_URL) return { status: 200, url, html: sitemapXml }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    LEGACY_CAREERS_URL,
    buildPayloadUrl('/careers'),
    CAREERS_PAGE_URL,
    buildPayloadUrl('/en-in/careers'),
    US_CAREERS_URL,
    buildPayloadUrl('/en-us/careers'),
    JOBS_URL,
    ROBOTS_TXT_URL,
    SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})
