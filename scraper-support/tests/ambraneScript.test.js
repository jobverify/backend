import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Ambrane India - Shop Power Banks, Cable, Chargers &amp; Other Accessories</title>
    <meta name="description" content="Ambrane India - Shop Power banks, Cables, Chargers &amp; Other Accessories">
  </head>
  <body>
    <header>
      <a href="/pages/about-us">About us</a>
      <a href="/pages/support">Customer Support</a>
    </header>
    <main>
      <p>Warranty registration</p>
      <p>Corporate Enquiries</p>
      <p>Subscribe to our newsletter</p>
      <a href="mailto:care@ambraneindia.com">care@ambraneindia.com</a>
      <div class="shopify-section"></div>
      <script src="https://ambraneindia.myshopify.com/cdn/shop/t/105/assets/global.js"></script>
    </main>
  </body>
</html>
`

const emptyCareerShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Career</title>
    <meta name="description" content="Ambrane India - Shop Power banks, Cables, Chargers &amp; Other Accessories">
    <meta name="keywords" content="Career, Ambrane India, ambraneindia.com">
    <meta name="author" content="Ambrane India Pvt Ltd">
    <meta property="og:url" content="https://ambraneindia.com/pages/career">
    <meta name="robots" content="noindex, nofollow">
  </head>
  <body class="template-page">
    <main id="MainContent" class="content-for-layout focus-none" role="main" tabindex="-1">
      <section id="shopify-section-template--23301594579191__main" class="shopify-section t4s-section t4s-section-main">
        <div class="t4s-section-inner t4s-container-wrap">Liquid error (sections/main-page line 20): invalid url input</div>
      </section>
      <footer>
        <p>Warranty registration</p>
        <p>Corporate Enquiries</p>
        <p>Subscribe to our newsletter</p>
        <a href="mailto:care@ambraneindia.com">care@ambraneindia.com</a>
      </footer>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>404</h1>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://ambraneindia.com/sitemap_products_1.xml?from=1000&amp;to=2000</loc>
  </sitemap>
  <sitemap>
    <loc>https://ambraneindia.com/sitemap_collections_1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://ambraneindia.com/sitemap_pages_1.xml</loc>
  </sitemap>
</sitemapindex>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Career</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.ashbyhq.com/ambrane/senior-engineer">Apply now</a>
  </body>
</html>
`

const sitemapWithCareerUrls = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ambraneindia.com/pages/career</loc></url>
  <url><loc>https://ambraneindia.com/careers</loc></url>
</urlset>
`

const loadAmbraneModule = async () => {
  try {
    return await import('../../scraper/ambrane/script.js')
  } catch {
    assert.fail('Expected Ambrane scraper module at ../../scraper/ambrane/script.js')
  }
}

test('Ambrane helpers stay pinned to the verified homepage shell, empty career page, and missing route set', async () => {
  const ambrane = await loadAmbraneModule()

  assert.equal(ambrane.SOURCE, 'ambrane')
  assert.equal(ambrane.COMPANY, 'Ambrane')
  assert.equal(ambrane.OFFICIAL_BRAND_NAME, 'Ambrane')
  assert.equal(ambrane.VERIFIED_ON, '2026-07-15')
  assert.equal(ambrane.HOMEPAGE_URL, 'https://ambraneindia.com/')
  assert.equal(ambrane.CAREER_PAGE_URL, 'https://ambraneindia.com/pages/career')
  assert.equal(ambrane.SITEMAP_URL, 'https://ambraneindia.com/sitemap.xml')
  assert.deepEqual(ambrane.CHECKED_MISSING_ROUTE_URLS, [
    'https://ambraneindia.com/careers',
    'https://ambraneindia.com/career',
    'https://ambraneindia.com/jobs',
    'https://ambraneindia.com/join-us',
    'https://ambraneindia.com/openings',
    'https://ambraneindia.com/pages/careers',
    'https://ambraneindia.com/pages/jobs',
    'https://ambraneindia.com/pages/join-us',
  ])
  assert.equal(ambrane.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ambrane.hasEmptyCareerShellSignal(emptyCareerShellHtml), true)
  assert.equal(ambrane.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(ambrane.hasPublicJobsSignal(publicJobsHtml), true)
  assert.deepEqual(ambrane.extractCareerLikeUrlsFromSitemap(sitemapXml), [])
  assert.deepEqual(ambrane.extractCareerLikeUrlsFromSitemap(sitemapWithCareerUrls), [
    'https://ambraneindia.com/pages/career',
    'https://ambraneindia.com/careers',
  ])
  assert.equal(
    ambrane.isMissingCareerRoute({
      status: 404,
      url: ambrane.CHECKED_MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Ambrane returns [] only while the verified first-party career page stays an empty shell and the common routes stay missing', async () => {
  const ambrane = await loadAmbraneModule()
  const requestedUrls = []

  const jobs = await ambrane.createAmbraneScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ambrane.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ambrane.CAREER_PAGE_URL) {
        return { status: 200, url, html: emptyCareerShellHtml }
      }

      if (url === ambrane.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (ambrane.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Ambrane URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ambrane.HOMEPAGE_URL,
    ambrane.CAREER_PAGE_URL,
    ...ambrane.CHECKED_MISSING_ROUTE_URLS,
    ambrane.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Ambrane fails closed when the homepage, empty career shell, missing-route validation, or sitemap career drift changes', async () => {
  const ambrane = await loadAmbraneModule()

  await assert.rejects(
    ambrane.createAmbraneScraper().run({
      fetchPage: async (url) => {
        if (url === ambrane.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Ambrane URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    ambrane.createAmbraneScraper().run({
      fetchPage: async (url) => {
        if (url === ambrane.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ambrane.CAREER_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Ambrane URL: ${url}`)
      },
    }),
    /verified empty career page/i,
  )

  await assert.rejects(
    ambrane.createAmbraneScraper().run({
      fetchPage: async (url) => {
        if (url === ambrane.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ambrane.CAREER_PAGE_URL) {
          return { status: 200, url, html: emptyCareerShellHtml }
        }

        if (url === ambrane.CHECKED_MISSING_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url === ambrane.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified missing career route changed/i,
  )

  await assert.rejects(
    ambrane.createAmbraneScraper().run({
      fetchPage: async (url) => {
        if (url === ambrane.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ambrane.CAREER_PAGE_URL) {
          return { status: 200, url, html: emptyCareerShellHtml }
        }

        if (ambrane.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        if (url === ambrane.SITEMAP_URL) {
          return { status: 200, url, html: sitemapWithCareerUrls }
        }

        throw new Error(`Unexpected Ambrane URL: ${url}`)
      },
    }),
    /verified sitemap career surface changed/i,
  )
})
