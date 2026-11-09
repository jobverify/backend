import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  OFFICIAL_BRAND_NAME,
  ROBOTS_TXT_URL,
  SITEMAP_URL,
  SOURCE,
  VERIFIED_ON,
  createFreshToHomeScraper,
  extractCareerLikeUrlsFromSitemap,
  hasExpectedRobotsTxtSignal,
  hasFirstPartyCareerLikeLink,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isMissingCareerRoute,
} from '../../scraper/freshtohome/script.js'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>FreshToHome - Order Fresh Fish, Chicken and Mutton Online.</title>
  </head>
  <body>
    <header>
      <span>1800-313-3302</span>
      <a href="mailto:customercare@freshtohome.com">customercare@freshtohome.com</a>
      <a href="/certificates">Certificates</a>
      <a href="/newsroom">Newsroom</a>
      <a href="/sell-with-us">Sell-With-Us</a>
    </header>
    <main>
      <nav>
        <a href="/fish-seafood.html">Fish &amp; Seafood</a>
        <a href="/poultry.html">Poultry</a>
        <a href="/mutton.html">Mutton</a>
        <a href="/catalog-elastic/search/?q=Jobfish">Jobfish</a>
      </nav>
      <p>Become a Purple Member and ENJOY UNLIMITED FREE HOME DELIVERY, exclusive deals and more!</p>
    </main>
  </body>
</html>
`

const currentHomepageHtml = homepageHtml.replace('<a href="/sell-with-us">Sell-With-Us</a>', '')

const robotsTxt = `
## GENERAL SETTINGS ##
User-agent: *
Sitemap: https://www.freshtohome.com/sitemap/sitemap.xml
Sitemap: https://www.freshtohome.com/blog/sitemap_index.xml
Disallow: /admin/
Disallow: /catalogsearch/
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.freshtohome.com/marine-fish.html</loc>
  </url>
  <url>
    <loc>https://www.freshtohome.com/shell-fish.html</loc>
  </url>
  <url>
    <loc>https://www.freshtohome.com/freshwater-fish.html</loc>
  </url>
</urlset>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <header>
      <a href="mailto:customercare@freshtohome.com">customercare@freshtohome.com</a>
      <a href="/sell-with-us">Sell-With-Us</a>
    </header>
    <main>
      <p>The page you wanted to visit could not be found.</p>
      <p>WERE YOU LOOKING FOR SOMETHING SPECIAL?</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>FreshToHome Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/freshtohome/senior-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const sitemapWithCareerUrls = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.freshtohome.com/marine-fish.html</loc>
  </url>
  <url>
    <loc>https://www.freshtohome.com/careers</loc>
  </url>
</urlset>
`

test('FreshToHome helpers stay pinned to the verified homepage, sitemap, and missing-route contract', () => {
  assert.equal(SOURCE, 'freshtohome')
  assert.equal(COMPANY, 'FreshToHome')
  assert.equal(OFFICIAL_BRAND_NAME, 'FreshToHome')
  assert.equal(VERIFIED_ON, '2026-09-03')
  assert.equal(HOMEPAGE_URL, 'https://www.freshtohome.com/')
  assert.equal(ROBOTS_TXT_URL, 'https://www.freshtohome.com/robots.txt')
  assert.equal(SITEMAP_URL, 'https://www.freshtohome.com/sitemap/sitemap.xml')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://www.freshtohome.com/careers',
    'https://www.freshtohome.com/career',
    'https://www.freshtohome.com/jobs',
    'https://www.freshtohome.com/join-us',
    'https://www.freshtohome.com/work-with-us',
    'https://www.freshtohome.com/openings',
    'https://www.freshtohome.com/current-openings',
  ])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(hasFirstPartyCareerLikeLink('<a href="/careers">Careers</a>'), true)
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(publicJobsHtml), true)
  assert.deepEqual(extractCareerLikeUrlsFromSitemap(sitemapXml), [])
  assert.deepEqual(extractCareerLikeUrlsFromSitemap(sitemapWithCareerUrls), [
    'https://www.freshtohome.com/careers',
  ])
  assert.equal(
    isMissingCareerRoute({
      status: 404,
      url: CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('FreshToHome returns [] only while the verified homepage, crawl surfaces, and common careers routes stay in the no-public-jobs state', async () => {
  const requestedUrls = []

  const jobs = await createFreshToHomeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
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

      throw new Error(`Unexpected FreshToHome URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    ROBOTS_TXT_URL,
    SITEMAP_URL,
    ...CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('FreshToHome fails closed when the homepage, robots, sitemap, or missing careers routes drift materially', async () => {
  await assert.rejects(
    createFreshToHomeScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected FreshToHome URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    createFreshToHomeScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *\nDisallow: /admin/' }
        }

        throw new Error(`Unexpected FreshToHome URL: ${url}`)
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    createFreshToHomeScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === SITEMAP_URL) {
          return { status: 200, url, html: sitemapWithCareerUrls }
        }

        throw new Error(`Unexpected FreshToHome URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    createFreshToHomeScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
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
