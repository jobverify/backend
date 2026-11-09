import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="author" content="Aspire Events & Exhibitions">
      <title>Aspire Events &amp; Exhibitions | Leading Exhibition &amp; Event Management Company in South India</title>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const verifiedSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://aspireevents.in/</loc>
      <lastmod>2026-04-21</lastmod>
      <changefreq>monthly</changefreq>
      <priority>1.0</priority>
    </url>
  </urlset>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/aspireeventsandexhibitions/script.js')
  } catch {
    assert.fail('Expected Aspire Events & Exhibitions scraper module at ../../scraper/aspireeventsandexhibitions/script.js')
  }
}

test('Aspire Events & Exhibitions validates the verified homepage shell, sitemap, and checked first-party routes', async () => {
  const aspire = await loadModule()

  assert.equal(aspire.SOURCE, 'aspireeventsandexhibitions')
  assert.equal(aspire.COMPANY, 'Aspire Events & Exhibitions')
  assert.equal(aspire.HOMEPAGE_URL, 'https://www.aspireevents.in/')
  assert.equal(aspire.SITEMAP_URL, 'https://aspireevents.in/sitemap.xml')
  assert.deepEqual(aspire.CHECKED_ROUTE_URLS, [
    'https://www.aspireevents.in/careers',
    'https://www.aspireevents.in/career',
    'https://www.aspireevents.in/jobs',
    'https://www.aspireevents.in/join-us',
  ])
  assert.equal(aspire.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(aspire.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(aspire.sitemapLacksCareerRoutes(verifiedSitemapXml), true)
  assert.equal(
    aspire.routeMatchesVerifiedShell(
      verifiedHomepageHtml,
      aspire.buildShellSignature(verifiedHomepageHtml),
    ),
    true,
  )
})

test('Aspire Events & Exhibitions returns no jobs only while the verified first-party routes stay on the same empty shell', async () => {
  const aspire = await loadModule()
  const requestedUrls = []

  const jobs = await aspire.createAspireEventsAndExhibitionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aspire.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === aspire.SITEMAP_URL) {
        return { status: 200, url, html: verifiedSitemapXml }
      }

      if (aspire.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aspire.HOMEPAGE_URL,
    aspire.SITEMAP_URL,
    ...aspire.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Aspire Events & Exhibitions fails closed when the homepage shell changes, the sitemap grows careers URLs, or a checked route exposes jobs', async () => {
  const aspire = await loadModule()

  await assert.rejects(
    aspire.createAspireEventsAndExhibitionsScraper().run({
      fetchPage: async (url) => {
        if (url === aspire.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }

        return { status: 200, url, html: verifiedHomepageHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aspire.createAspireEventsAndExhibitionsScraper().run({
      fetchPage: async (url) => {
        if (url === aspire.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === aspire.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${verifiedSitemapXml}<url><loc>https://www.aspireevents.in/careers</loc></url>`,
          }
        }

        return { status: 200, url, html: verifiedHomepageHtml }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    aspire.createAspireEventsAndExhibitionsScraper().run({
      fetchPage: async (url) => {
        if (url === aspire.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === aspire.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        if (url === aspire.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml.replace(
              '</div>',
              '<section><h2>Current Openings</h2><a href=\"https://jobs.ashbyhq.com/aspireevents/designer\">Apply now</a></section></div>',
            ),
          }
        }

        return { status: 200, url, html: verifiedHomepageHtml }
      },
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
