import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buy Gifts, Greeting Cards, Cakes &amp; Flowers Online | Archies \u2013 Archies Online</title>
    <link rel="canonical" href="https://archiesonline.com/">
    <meta property="og:description" content="Shop online for personalized gifts, greeting cards, cakes, and fresh flowers at Archies. Make every celebration special with Archies Online.">
  </head>
  <body>
    <a href="mailto:helpdesk@archiesonline.com">helpdesk@archiesonline.com</a>
    <a href="https://www.linkedin.com/company/archies-limited/">LinkedIn</a>
    <a href="/pages/contact">Contact</a>
    <a href="/pages/store-locator">Store Locator</a>
  </body>
</html>
`

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found \u2013 Archies Online</title>
    <link rel="canonical" href="https://archiesonline.com/404">
    <script type="application/json">{"pageType":"404"}</script>
  </head>
  <body>
    <h1>404 Not Found</h1>
    <a href="mailto:helpdesk@archiesonline.com">helpdesk@archiesonline.com</a>
  </body>
</html>
`

const robotsTxt = `
# Shopify storefront. Public product, collection, page, blog, policy, cart, and localized HTML is crawlable.
User-agent: *
Disallow: /cart
Sitemap: https://archiesonline.com/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://archiesonline.com/sitemap_agentic_discovery.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://archiesonline.com/sitemap_products_1.xml?from=8789251424405&amp;to=8957165437077</loc>
  </sitemap>
  <sitemap>
    <loc>https://archiesonline.com/sitemap_products_2.xml?from=8957165502613&amp;to=9284182933653</loc>
  </sitemap>
  <sitemap>
    <loc>https://archiesonline.com/sitemap_pages_1.xml?from=693794865301&amp;to=710639354005</loc>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://archiesonline.com/pages/contact</loc>
  </url>
  <url>
    <loc>https://archiesonline.com/pages/wish-list</loc>
  </url>
  <url>
    <loc>https://archiesonline.com/pages/store-locator</loc>
  </url>
  <url>
    <loc>https://archiesonline.com/pages/about</loc>
  </url>
  <url>
    <loc>https://archiesonline.com/pages/track-orders</loc>
  </url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Archies Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://archiesonline.com/apply">Apply now</a>
  </body>
</html>
`

const loadArchiesModule = async () => {
  try {
    return await import('../../scraper/archies/script.js')
  } catch {
    assert.fail('Expected Archies scraper module at ../../scraper/archies/script.js')
  }
}

test('Archies scraper constants stay pinned to the verified first-party no-public-jobs storefront surface', async () => {
  const archies = await loadArchiesModule()

  assert.equal(archies.SOURCE, 'archies')
  assert.equal(archies.COMPANY, 'Archies')
  assert.equal(archies.OFFICIAL_BRAND_NAME, 'Archies Online')
  assert.equal(archies.VERIFIED_ON, '2026-07-15')
  assert.equal(archies.HOMEPAGE_URL, 'https://archiesonline.com/')
  assert.deepEqual(archies.CAREERS_ROUTE_URLS, [
    'https://archiesonline.com/careers',
    'https://archiesonline.com/career',
    'https://archiesonline.com/jobs',
    'https://archiesonline.com/join-us',
    'https://archiesonline.com/work-with-us',
    'https://archiesonline.com/openings',
  ])
  assert.deepEqual(archies.CRAWL_SURFACE_URLS, [
    'https://archiesonline.com/robots.txt',
    'https://archiesonline.com/sitemap.xml',
    'https://archiesonline.com/sitemap_pages_1.xml?from=693794865301&to=710639354005',
  ])
  assert.match(archies.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(archies.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(archies.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(archies.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(archies.hasOfficialRobotsTxtSignal(robotsTxt), true)
  assert.equal(archies.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(archies.hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(archies.hasCareerRouteInSitemap(sitemapXml), false)
  assert.equal(archies.hasCareerRouteInSitemap(pageSitemapXml), false)
  assert.equal(archies.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    archies.hasFirstPartyCareerLikeLink('<a href="https://archiesonline.com/careers">Careers</a>'),
    true,
  )
  assert.equal(
    archies.isMissingCareerRoute({
      status: 404,
      url: archies.CAREERS_ROUTE_URLS[0],
      html: careers404Html,
    }),
    true,
  )
})

test('Archies returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const archies = await loadArchiesModule()
  const requestedUrls = []

  const jobs = await archies.createArchiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === archies.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === 'https://archiesonline.com/robots.txt') {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === 'https://archiesonline.com/sitemap.xml') {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === 'https://archiesonline.com/sitemap_pages_1.xml?from=693794865301&to=710639354005') {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (archies.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url: 'https://archiesonline.com/404', html: careers404Html }
      }

      throw new Error(`Unexpected Archies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    archies.HOMEPAGE_URL,
    ...archies.CRAWL_SURFACE_URLS,
    ...archies.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Archies fails closed when the verified homepage, crawl surfaces, or missing careers routes drift into a public jobs surface', async () => {
  const archies = await loadArchiesModule()

  await assert.rejects(
    archies.createArchiesScraper().run({
      fetchPage: async (url) => {
        if (url === archies.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Archies URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    archies.createArchiesScraper().run({
      fetchPage: async (url) => {
        if (url === archies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://archiesonline.com/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected Archies URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    archies.createArchiesScraper().run({
      fetchPage: async (url) => {
        if (url === archies.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === 'https://archiesonline.com/robots.txt') {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === 'https://archiesonline.com/sitemap.xml') {
          return {
            status: 200,
            url,
            html: `${sitemapXml}<sitemap><loc>https://archiesonline.com/careers</loc></sitemap>`,
          }
        }

        throw new Error(`Unexpected Archies URL: ${url}`)
      },
    }),
    /sitemap now advertises a careers or jobs route/i,
  )

  await assert.rejects(
    archies.createArchiesScraper().run({
      fetchPage: async (url) => {
        if (url === archies.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === 'https://archiesonline.com/robots.txt') {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === 'https://archiesonline.com/sitemap.xml') {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === 'https://archiesonline.com/sitemap_pages_1.xml?from=693794865301&to=710639354005') {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === archies.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url: 'https://archiesonline.com/404', html: careers404Html }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
