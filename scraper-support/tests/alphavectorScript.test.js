import assert from 'node:assert/strict'
import test from 'node:test'

const parkedRedirectHtml = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.onload = function () { window.location.href = "/lander" }
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
  <url><loc>https://alphavector.co/lander</loc></url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Alphavector</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/alphavector/apply">Apply now</a>
  </body>
</html>
`

const loadAlphavectorModule = async () => {
  try {
    return await import('../../scraper/alphavector/script.js')
  } catch {
    assert.fail('Expected Alphavector scraper module at ../../scraper/alphavector/script.js')
  }
}

test('Alphavector scraper constants stay pinned to the verified parked homepage, crawl surface, and common careers routes', async () => {
  const alphavector = await loadAlphavectorModule()

  assert.equal(alphavector.SOURCE, 'alphavector')
  assert.equal(alphavector.COMPANY, 'Alphavector')
  assert.equal(alphavector.HOMEPAGE_URL, 'https://alphavector.co/')
  assert.equal(alphavector.LANDER_PATH, '/lander')
  assert.equal(alphavector.ROBOTS_TXT_URL, 'https://alphavector.co/robots.txt')
  assert.equal(alphavector.SITEMAP_URL, 'https://alphavector.co/sitemap.xml')
  assert.deepEqual(alphavector.CAREERS_ROUTE_URLS, [
    'https://alphavector.co/careers',
    'https://alphavector.co/career',
    'https://alphavector.co/jobs',
    'https://alphavector.co/join-us',
    'https://alphavector.co/work-with-us',
    'https://alphavector.co/openings',
    'https://alphavector.co/current-openings',
  ])
  assert.equal(alphavector.hasParkedHomepageSignal(parkedRedirectHtml), true)
  assert.equal(alphavector.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(alphavector.hasExpectedSitemapSignal(sitemapXml), true)
  assert.deepEqual(alphavector.extractSitemapUrls(sitemapXml), ['https://alphavector.co/lander'])
  assert.equal(alphavector.hasPublicJobsSignal(parkedRedirectHtml), false)
  assert.equal(alphavector.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Alphavector returns no jobs only while the verified first-party domain stays a parked redirect shell', async () => {
  const alphavector = await loadAlphavectorModule()
  const requestedUrls = []

  const jobs = await alphavector.createAlphavectorScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === alphavector.HOMEPAGE_URL) {
        return { status: 200, url, html: parkedRedirectHtml }
      }

      if (url === alphavector.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === alphavector.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (alphavector.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: parkedRedirectHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    alphavector.HOMEPAGE_URL,
    alphavector.ROBOTS_TXT_URL,
    alphavector.SITEMAP_URL,
    ...alphavector.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Alphavector fails closed when the parked homepage, crawl surface, or checked careers routes drift into a public jobs surface', async () => {
  const alphavector = await loadAlphavectorModule()

  await assert.rejects(
    alphavector.createAlphavectorScraper().run({
      fetchPage: async (url) => {
        if (url === alphavector.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified parked homepage/i,
  )

  await assert.rejects(
    alphavector.createAlphavectorScraper().run({
      fetchPage: async (url) => {
        if (url === alphavector.HOMEPAGE_URL) {
          return { status: 200, url, html: parkedRedirectHtml }
        }

        if (url === alphavector.ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *\nDisallow: /' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    alphavector.createAlphavectorScraper().run({
      fetchPage: async (url) => {
        if (url === alphavector.HOMEPAGE_URL) {
          return { status: 200, url, html: parkedRedirectHtml }
        }

        if (url === alphavector.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === alphavector.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://alphavector.co/careers</loc></url>
              </urlset>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    alphavector.createAlphavectorScraper().run({
      fetchPage: async (url) => {
        if (url === alphavector.HOMEPAGE_URL) {
          return { status: 200, url, html: parkedRedirectHtml }
        }

        if (url === alphavector.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === alphavector.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === alphavector.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 200, url, html: parkedRedirectHtml }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
