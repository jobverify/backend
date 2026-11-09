import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
  <html lang="en">
  <head>
    <title>Apex Imports | Now Serving Raleigh NC and Sanford NC</title>
  </head>
  <body>
    <main>
      <h1>Apex Imports</h1>
      <p>Apex Imports has moved!</p>
      <a href="/used-cars">Shop Used Cars</a>
      <p>2407 Wake Forest Rd Raleigh NC 27608</p>
      <p>1301 Douglas Dr Sanford NC 27330</p>
    </main>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
`

const missingRouteHtml = `
The requested URL was not found on this server.
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Apex Imports Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Operations Lead"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/apeximports/operations-lead">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/apeximports/script.js')
  } catch {
    assert.fail('Expected Apex Imports scraper module at ../../scraper/apeximports/script.js')
  }
}

test('Apex Imports helpers stay pinned to the verified moved homepage, robots.txt, and missing careers routes', async () => {
  const apex = await loadModule()

  assert.equal(apex.SOURCE, 'apeximports')
  assert.equal(apex.COMPANY, 'Apex Imports')
  assert.equal(apex.VERIFIED_ON, '2026-07-15')
  assert.equal(apex.HOMEPAGE_URL, 'https://www.apeximports.com/')
  assert.equal(apex.ROBOTS_TXT_URL, 'https://www.apeximports.com/robots.txt')
  assert.equal(apex.SITEMAP_URL, 'https://www.apeximports.com/sitemap.xml')
  assert.deepEqual(apex.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.apeximports.com/careers',
    'https://www.apeximports.com/career',
    'https://www.apeximports.com/jobs',
    'https://www.apeximports.com/join-us',
    'https://www.apeximports.com/work-with-us',
    'https://www.apeximports.com/openings',
  ])
  assert.match(apex.VERIFIED_SURFACE_SUMMARY, /Hanna Imports/i)
  assert.equal(apex.hasMovedHomepageSignal(homepageHtml), true)
  assert.equal(apex.hasRobotsTxtNoCareersSignal(robotsTxt), true)
  assert.equal(apex.pageExposesPublicJobListings(homepageHtml), false)
  assert.equal(apex.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    apex.isVerifiedMissingRoute(
      {
        status: 404,
        url: 'https://www.apeximports.com/jobs',
        html: missingRouteHtml,
      },
      'https://www.apeximports.com/jobs',
    ),
    true,
  )
})

test('Apex Imports returns no jobs while the verified moved homepage, robots.txt, and missing careers routes remain unchanged', async () => {
  const apex = await loadModule()
  const requestedUrls = []

  const jobs = await apex.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === apex.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === apex.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === apex.SITEMAP_URL || apex.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    apex.HOMEPAGE_URL,
    apex.ROBOTS_TXT_URL,
    apex.SITEMAP_URL,
    ...apex.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Apex Imports fails closed when the homepage, robots.txt, sitemap, or careers routes drift into a public jobs surface', async () => {
  const apex = await loadModule()

  await assert.rejects(
    apex.run({
      fetchPage: async (url) => {
        if (url === apex.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Apex Imports</title></head><body>Placeholder</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /moved homepage no longer matches/i,
  )

  await assert.rejects(
    apex.run({
      fetchPage: async (url) => {
        if (url === apex.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === apex.ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /careers\n' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots\.txt now advertises a careers surface/i,
  )

  await assert.rejects(
    apex.run({
      fetchPage: async (url) => {
        if (url === apex.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === apex.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === apex.SITEMAP_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing sitemap route changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    apex.run({
      fetchPage: async (url) => {
        if (url === apex.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === apex.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === apex.SITEMAP_URL) {
          return { status: 404, url, html: missingRouteHtml }
        }

        if (url === apex.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (apex.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing careers route changed materially or now exposes public jobs/i,
  )
})
