import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DTDC | India’s Trusted Courier Delivery & Logistics Company</title>
    <link rel="canonical" href="https://www.dtdc.com/in/">
  </head>
  <body>
    <h1>Leading Courier and Logistics Company in India</h1>
    <a href="https://www.dtdc.com/career/">Career</a>
    <a href="https://www.dtdc.com/contact-us/">Contact Us</a>
    <!--
      <div class="job-card">
        <h5>Manager - Operations</h5>
        <a href="#" class="btn-primary">View Jobs</a>
      </div>
    -->
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://www.dtdc.com/in/">
  </head>
  <body>
    <p>www.dtdc.com is DTDC's only official website.</p>
    <h1>Leading Courier and Logistics Company in India</h1>
    <a href="https://www.dtdc.com/career/">Career</a>
    <a href="https://www.dtdc.com/contact-us/">Contact Us</a>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career and Jobs in Logistics and Courier Services | DTDC</title>
    <link rel="canonical" href="https://www.dtdc.com/career/">
  </head>
  <body>
    <h1>Drive Your Career Forward in Logistics</h1>
    <p>At DTDC, we value innovation, customer centricity, and ownership.</p>
    <p>Please drop your CV at <a href="mailto:careers@dtdc.com">careers@dtdc.com</a>.</p>
    <p>Join the team that powers India’s logistics network.</p>
  </body>
</html>
`

const robotsTxt = `
# Termly scanner
User-agent: TermlyBot
Allow: /

User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://www.dtdc.com/sitemap_index.xml
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.dtdc.com/post-sitemap.xml</loc>
    <lastmod>2026-07-14T11:16:56+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.dtdc.com/page-sitemap.xml</loc>
    <lastmod>2026-07-14T14:21:20+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.dtdc.com/category-sitemap.xml</loc>
    <lastmod>2026-07-14T11:16:56+00:00</lastmod>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.dtdc.com/</loc>
  </url>
  <url>
    <loc>https://www.dtdc.com/career/</loc>
  </url>
  <url>
    <loc>https://www.dtdc.com/contact-us/</loc>
  </url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DTDC Jobs</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Operations Manager"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/dtdc/apply">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dtdc/script.js')
  } catch {
    assert.fail('Expected DTDC scraper module at ../../scraper/dtdc/script.js')
  }
}

test('DTDC pins the verified homepage, career page, robots contract, and sitemap surface', async () => {
  const dtdc = await loadModule()

  assert.equal(dtdc.SOURCE, 'dtdc')
  assert.equal(dtdc.COMPANY, 'DTDC')
  assert.equal(dtdc.ROOT_URL, 'https://www.dtdc.com/')
  assert.equal(dtdc.HOME_URL, 'https://www.dtdc.com/in/')
  assert.equal(dtdc.CAREERS_URL, 'https://www.dtdc.com/career/')
  assert.equal(dtdc.ROBOTS_URL, 'https://www.dtdc.com/robots.txt')
  assert.equal(dtdc.SITEMAP_INDEX_URL, 'https://www.dtdc.com/sitemap_index.xml')
  assert.equal(dtdc.PAGE_SITEMAP_URL, 'https://www.dtdc.com/page-sitemap.xml')
  assert.deepEqual(dtdc.MISSING_JOB_ROUTE_URLS, [
    'https://www.dtdc.com/jobs/',
    'https://www.dtdc.com/careers/',
    'https://www.dtdc.com/join-us/',
    'https://www.dtdc.com/work-with-us/',
  ])
  assert.equal(dtdc.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(dtdc.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(dtdc.hasResumeDropCareersSignal(careersPageHtml), true)
  assert.equal(dtdc.hasPublicJobListingSignal(careersPageHtml), false)
  assert.equal(dtdc.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(
    dtdc.extractSitemapUrlFromRobots(robotsTxt),
    'https://www.dtdc.com/sitemap_index.xml',
  )
  assert.equal(dtdc.hasVerifiedSitemapIndexSignal(sitemapIndexXml), true)
  assert.deepEqual(dtdc.extractCareerLikeUrlsFromPageSitemap(pageSitemapXml), [
    'https://www.dtdc.com/career/',
  ])
  assert.equal(
    dtdc.isKnownMissingJobRoute(
      { status: 404, url: 'https://www.dtdc.com/jobs/', html: '<html><body>404</body></html>' },
      'https://www.dtdc.com/jobs/',
    ),
    true,
  )
})

test('DTDC returns no jobs only while the verified first-party career page remains a resume-drop surface', async () => {
  const dtdc = await loadModule()
  const requestedUrls = []

  const jobs = await dtdc.createDtdcScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === dtdc.ROOT_URL) {
        return { status: 200, url: dtdc.HOME_URL, html: homepageHtml }
      }

      if (url === dtdc.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === dtdc.ROBOTS_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === dtdc.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === dtdc.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (dtdc.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>404</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    dtdc.ROOT_URL,
    dtdc.CAREERS_URL,
    dtdc.ROBOTS_URL,
    dtdc.SITEMAP_INDEX_URL,
    dtdc.PAGE_SITEMAP_URL,
    ...dtdc.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('DTDC fails closed when the homepage redirect, careers page, sitemap, or missing-route contract drifts', async () => {
  const dtdc = await loadModule()

  await assert.rejects(
    dtdc.createDtdcScraper().run({
      fetchPage: async (url) => {
        if (url === dtdc.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage redirect/i,
  )

  await assert.rejects(
    dtdc.createDtdcScraper().run({
      fetchPage: async (url) => {
        if (url === dtdc.ROOT_URL) {
          return { status: 200, url: dtdc.HOME_URL, html: homepageHtml }
        }

        if (url === dtdc.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career page now appears to expose a public jobs board/i,
  )

  await assert.rejects(
    dtdc.createDtdcScraper().run({
      fetchPage: async (url) => {
        if (url === dtdc.ROOT_URL) {
          return { status: 200, url: dtdc.HOME_URL, html: homepageHtml }
        }

        if (url === dtdc.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === dtdc.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /\n' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    dtdc.createDtdcScraper().run({
      fetchPage: async (url) => {
        if (url === dtdc.ROOT_URL) {
          return { status: 200, url: dtdc.HOME_URL, html: homepageHtml }
        }

        if (url === dtdc.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === dtdc.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === dtdc.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === dtdc.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://www.dtdc.com/career/</loc></url>
                <url><loc>https://www.dtdc.com/jobs/</loc></url>
              </urlset>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified page sitemap/i,
  )

  await assert.rejects(
    dtdc.createDtdcScraper().run({
      fetchPage: async (url) => {
        if (url === dtdc.ROOT_URL) {
          return { status: 200, url: dtdc.HOME_URL, html: homepageHtml }
        }

        if (url === dtdc.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === dtdc.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === dtdc.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === dtdc.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === dtdc.MISSING_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Unexpected jobs page</body></html>' }
        }

        if (dtdc.MISSING_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: '<html><body>404</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )
})
