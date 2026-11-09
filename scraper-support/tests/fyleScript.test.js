import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  OFFICIAL_BRAND_NAME,
  RESOLVED_CAREERS_URL,
  ROBOTS_TXT_URL,
  SITEMAP_URL,
  SOURCE,
  VERIFIED_ON,
  createFyleScraper,
  extractCareerLikeUrlsFromSitemap,
  extractHomepageCareersUrl,
  hasExpectedRobotsTxtSignal,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isMissingCareerRoute,
  normalizeUrl,
} from '../../scraper/fyle/script.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Expense Tracking Software for Receipt and Expense Management</title>
  </head>
  <body>
    <header>
      <a href="/product">Product</a>
      <a href="/solutions">Solutions</a>
      <a href="/customers">Customers</a>
      <a href="/pricing">Pricing</a>
      <a href="/resources">Resources</a>
      <a href="/company/team/join">Careers</a>
    </header>
    <main>
      <h1>Real-time expense management on your existing credit cards</h1>
      <p>With Sage Expense Management (formerly Fyle), your team just texts a receipt — our AI handles the rest.</p>
      <p>No new cards. No extra effort. Just faster closes and happier finance teams.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sage Expense Management (formerly Fyle) | Join our team</title>
    <link rel="canonical" href="https://www.fylehq.com/company/team/join" />
  </head>
  <body>
    <main>
      <h1>Come work with us</h1>
      <p>Help us on our mission to make expense management fast, efficient and employee-friendly.</p>
      <p>What working at Sage Expense Management (formerly Fyle) feels like</p>
      <p>Life at Sage Expense Management (formerly Fyle)</p>
      <a href="/company/team">Meet the team</a>
      <a href="/company/team/stories">Read our stories</a>
    </main>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Allow: /
Allow: /blog/
Disallow: /classifier-search-data
Disallow: /cta-banners
Disallow: /thank-you
Sitemap: https://www.fylehq.com/sitemap.xml
`

const currentRobotsTxt = robotsTxt.replace('Sitemap: https://www.fylehq.com/sitemap.xml', 'Sitemap: https://www.fylehq.com/sitemap-index.xml')

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.fylehq.com/company/team/join</loc>
  </url>
  <url>
    <loc>https://www.fylehq.com/expense-management-software</loc>
  </url>
  <url>
    <loc>https://www.fylehq.com/customers/rockbot</loc>
  </url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404- Page not found | Sage Expense Management (formerly Fyle)</title>
  </head>
  <body>
    <main>
      <h1>Oops! Missing page :(</h1>
      <p>You can go back to homepage while we glue ourselves back together.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fyle Jobs</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/fyle/senior-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const sitemapWithExtraCareerUrls = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.fylehq.com/company/team/join</loc>
  </url>
  <url>
    <loc>https://www.fylehq.com/jobs</loc>
  </url>
</urlset>
`

test('Fyle helpers stay pinned to the verified homepage, careers shell, and missing-route contract', () => {
  assert.equal(SOURCE, 'fyle')
  assert.equal(COMPANY, 'Fyle')
  assert.equal(OFFICIAL_BRAND_NAME, 'Sage Expense Management (formerly Fyle)')
  assert.equal(VERIFIED_ON, '2026-09-03')
  assert.equal(HOMEPAGE_URL, 'https://www.fylehq.com/')
  assert.equal(CAREERS_URL, 'https://www.fylehq.com/careers')
  assert.equal(RESOLVED_CAREERS_URL, 'https://www.fylehq.com/company/team/join')
  assert.equal(ROBOTS_TXT_URL, 'https://www.fylehq.com/robots.txt')
  assert.equal(SITEMAP_URL, 'https://www.fylehq.com/sitemap.xml')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://www.fylehq.com/career',
    'https://www.fylehq.com/jobs',
    'https://www.fylehq.com/join-us',
    'https://www.fylehq.com/about/careers',
    'https://www.fylehq.com/company/careers',
    'https://www.fylehq.com/openings',
    'https://www.fylehq.com/work-with-us',
    'https://www.fylehq.com/current-openings',
  ])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(extractHomepageCareersUrl(homepageHtml), RESOLVED_CAREERS_URL)
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(hasExpectedRobotsTxtSignal(currentRobotsTxt), true)
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(publicJobsHtml), true)
  assert.deepEqual(extractCareerLikeUrlsFromSitemap(sitemapXml), [
    'https://www.fylehq.com/company/team/join',
  ])
  assert.deepEqual(extractCareerLikeUrlsFromSitemap(sitemapWithExtraCareerUrls), [
    'https://www.fylehq.com/company/team/join',
    'https://www.fylehq.com/jobs',
  ])
  assert.equal(normalizeUrl('https://www.fylehq.com/company/team/join/'), RESOLVED_CAREERS_URL)
  assert.equal(
    isMissingCareerRoute({
      status: 404,
      url: CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Fyle returns [] only while the verified careers route stays a non-listing shell and common alternate routes stay missing', async () => {
  const requestedUrls = []

  const jobs = await createFyleScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url: RESOLVED_CAREERS_URL, html: careersHtml }
      }

      if (url === ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Fyle URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    ROBOTS_TXT_URL,
    SITEMAP_URL,
    ...CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fyle fails closed when the homepage, careers shell, sitemap, or missing routes drift materially', async () => {
  await assert.rejects(
    createFyleScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Fyle URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    createFyleScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return { status: 200, url: RESOLVED_CAREERS_URL, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Fyle URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    createFyleScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return { status: 200, url: RESOLVED_CAREERS_URL, html: careersHtml }
        }

        if (url === ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === SITEMAP_URL) {
          return { status: 200, url, html: sitemapWithExtraCareerUrls }
        }

        throw new Error(`Unexpected Fyle URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    createFyleScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return { status: 200, url: RESOLVED_CAREERS_URL, html: careersHtml }
        }

        if (url === ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
