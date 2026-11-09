import assert from 'node:assert/strict'
import test from 'node:test'

const redirectShellHtml = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.onload = function(){window.location.href="/lander"}
    </script>
  </head>
</html>
`

const robotsTxt = `
User-agent: *
Allow: /
LLM-Policy: /llms.txt
Sitemap: /sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://authorstream.com/lander</loc></url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - AuthorStream</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/authorstream/apply">Apply now</a>
  </body>
</html>
`

const parkedRedirect = 'https://forsale.godaddy.com/forsale/authorstream.com?utm_source=TDFS_DASLNC&utm_medium=parkedpages&utm_campaign=x_corp_tdfs-daslnc_base&traffic_type=TDFS_DASLNC&traffic_id=daslnc&'

const loadModule = async () => {
  try {
    return await import('../../scraper/authorstream/script.js')
  } catch {
    assert.fail('Expected AuthorStream scraper module at ../../scraper/authorstream/script.js')
  }
}

test('AuthorStream scraper constants stay pinned to the verified parked redirect shell, crawl surface, and checked routes', async () => {
  const authorStream = await loadModule()

  assert.equal(authorStream.SOURCE, 'authorstream')
  assert.equal(authorStream.COMPANY, 'AuthorStream')
  assert.equal(authorStream.OFFICIAL_BRAND_NAME, 'AuthorStream')
  assert.equal(authorStream.VERIFIED_AT, '2026-08-07')
  assert.equal(authorStream.HOMEPAGE_URL, 'https://authorstream.com/')
  assert.equal(authorStream.LANDER_URL, 'https://authorstream.com/lander')
  assert.equal(authorStream.ROBOTS_TXT_URL, 'https://authorstream.com/robots.txt')
  assert.equal(authorStream.SITEMAP_URL, 'https://authorstream.com/sitemap.xml')
  assert.deepEqual(authorStream.CHECKED_ROUTE_URLS, [
    'https://authorstream.com/careers',
    'https://authorstream.com/career',
    'https://authorstream.com/jobs',
    'https://authorstream.com/about',
    'https://authorstream.com/contact-us',
  ])
  assert.equal(authorStream.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(authorStream.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(authorStream.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(authorStream.hasExpectedSitemapSignal(sitemapXml), true)
  assert.deepEqual(authorStream.extractSitemapUrls(sitemapXml), ['https://authorstream.com/lander'])
  assert.equal(
    authorStream.hasParkedLanderRedirect({
      status: 307,
      location: parkedRedirect,
    }),
    true,
  )
  assert.equal(authorStream.hasPublicJobsSignal(redirectShellHtml), false)
  assert.equal(authorStream.hasPublicJobsSignal(publicJobsHtml), true)
})

test('AuthorStream returns no jobs only while the verified first-party domain stays a parked redirect shell', async () => {
  const authorStream = await loadModule()
  const requestedUrls = []

  const jobs = await authorStream.createAuthorStreamScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === authorStream.HOMEPAGE_URL) {
        return { status: 200, url, html: redirectShellHtml }
      }

      if (url === authorStream.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === authorStream.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (authorStream.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: redirectShellHtml }
      }

      if (url === authorStream.LANDER_URL) {
        return {
          status: 307,
          url,
          location: parkedRedirect,
          html: '',
        }
      }

      throw new Error(`Unexpected AuthorStream URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    authorStream.HOMEPAGE_URL,
    authorStream.ROBOTS_TXT_URL,
    authorStream.SITEMAP_URL,
    ...authorStream.CHECKED_ROUTE_URLS,
    authorStream.LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('AuthorStream fails closed when the parked shell, crawl surface, checked routes, or lander redirect drift', async () => {
  const authorStream = await loadModule()

  await assert.rejects(
    authorStream.createAuthorStreamScraper().run({
      fetchPage: async (url) => {
        if (url === authorStream.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected AuthorStream URL: ${url}`)
      },
    }),
    /verified parked homepage/i,
  )

  await assert.rejects(
    authorStream.createAuthorStreamScraper().run({
      fetchPage: async (url) => {
        if (url === authorStream.HOMEPAGE_URL) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === authorStream.ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *\nDisallow: /' }
        }

        throw new Error(`Unexpected AuthorStream URL: ${url}`)
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    authorStream.createAuthorStreamScraper().run({
      fetchPage: async (url) => {
        if (url === authorStream.HOMEPAGE_URL) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === authorStream.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === authorStream.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://authorstream.com/careers</loc></url>
              </urlset>
            `,
          }
        }

        throw new Error(`Unexpected AuthorStream URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    authorStream.createAuthorStreamScraper().run({
      fetchPage: async (url) => {
        if (url === authorStream.HOMEPAGE_URL) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === authorStream.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === authorStream.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === authorStream.CHECKED_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 200, url, html: redirectShellHtml }
      },
    }),
    /verified no-public-careers route changed/i,
  )

  await assert.rejects(
    authorStream.createAuthorStreamScraper().run({
      fetchPage: async (url) => {
        if (url === authorStream.HOMEPAGE_URL) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === authorStream.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === authorStream.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (authorStream.CHECKED_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === authorStream.LANDER_URL) {
          return { status: 200, url, location: null, html: '' }
        }

        throw new Error(`Unexpected AuthorStream URL: ${url}`)
      },
    }),
    /parked-domain redirect changed/i,
  )
})
