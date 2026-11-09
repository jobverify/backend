import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en-IN">
    <head>
      <title>wizfreight.com</title>
      <meta name="author" content="wizfreight.com" />
      <meta name="generator" content="Starfield Technologies; Go Daddy Website Builder 8.0.0000" />
      <meta name="twitter:description" content="Launching Soon" />
    </head>
    <body>
      <main>
        <h1>Launching Soon</h1>
        <p>Contact Us</p>
        <p>Powered by</p>
        <nav>
          <a href="/shop">Shop</a>
          <a href="/m/login">Sign In</a>
          <a href="/m/orders">Orders</a>
          <a href="/m/account">Create Account</a>
        </nav>
        <p>Copyright © 2026 wizfreight.com - All Rights Reserved.</p>
        <script>
          window.__WAM__ = {
            wam_site_businessCategory: 'coming_soon',
            wam_site_isHomepage: true
          }
        </script>
      </main>
    </body>
  </html>
`

const careers404Html = `
  <!doctype html>
  <html lang="en-IN">
    <head>
      <title>wizfreight.com</title>
      <meta name="author" content="wizfreight.com" />
      <meta name="generator" content="Starfield Technologies; Go Daddy Website Builder 8.0.0000" />
      <meta property="og:url" content="https://wizfreight.com/404" />
    </head>
    <body>
      <main>
        <h1>Page Not Found</h1>
        <p>We can’t seem to find the page you’re looking for.</p>
        <a href="/">Go To Home Page</a>
        <nav>
          <a href="/shop">Shop</a>
          <a href="/m/login">Sign In</a>
          <a href="/m/orders">Orders</a>
          <a href="/m/account">Create Account</a>
        </nav>
        <script>
          window.__WAM__ = {
            wam_site_isHomepage: false
          }
        </script>
      </main>
    </body>
  </html>
`

const sitemapIndexXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap><loc>http://wizfreight.com/sitemap.website.xml</loc></sitemap>
    <sitemap><loc>http://wizfreight.com/sitemap.ols.xml</loc></sitemap>
  </sitemapindex>
`

const websiteSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>http://wizfreight.com/shop</loc><lastmod>2026-05-07</lastmod><changefreq>weekly</changefreq></url>
    <url><loc>http://wizfreight.com/terms-and-conditions</loc><lastmod>2026-05-07</lastmod><changefreq>weekly</changefreq></url>
    <url><loc>http://wizfreight.com/</loc><lastmod>2026-05-07</lastmod><changefreq>weekly</changefreq></url>
    <url><loc>http://wizfreight.com/privacy-policy</loc><lastmod>2026-05-07</lastmod><changefreq>weekly</changefreq></url>
    <url><loc>http://wizfreight.com/m/login</loc><lastmod>2026-05-07</lastmod><changefreq>weekly</changefreq></url>
  </urlset>
`

const createUnavailableError = () => {
  const error = new Error('fetch failed')
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted addresses: 76.223.105.230:443, 13.248.243.5:443, timeout: 10000ms)',
  }
  return error
}

test('Wiz Frieght scraper module loads and recognizes the verified first-party no-careers surface', async () => {
  const wizfrieght = await loadModule()
  assert.ok(wizfrieght, 'Wiz Frieght scraper module should load')

  const {
    CAREERS_ROUTE_URLS,
    COMPANY,
    HOMEPAGE_URL,
    SITEMAP_INDEX_URL,
    SOURCE,
    VERIFIED_AT,
    WEBSITE_SITEMAP_URL,
    hasOfficialHomepageSignal,
    hasPublicJobsSignal,
    hasVerified404CareersSignal,
    hasVerifiedSitemapIndexSignal,
    hasVerifiedWebsiteSitemapSignal,
    isVerifiedNoPublicCareersRoute,
  } = wizfrieght

  assert.equal(SOURCE, 'wizfrieght')
  assert.equal(COMPANY, 'Wiz Frieght')
  assert.equal(VERIFIED_AT, '2026-08-15')
  assert.equal(HOMEPAGE_URL, 'https://wizfreight.com/')
  assert.equal(SITEMAP_INDEX_URL, 'https://wizfreight.com/sitemap.xml')
  assert.equal(WEBSITE_SITEMAP_URL, 'https://wizfreight.com/sitemap.website.xml')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://wizfreight.com/careers',
    'https://wizfreight.com/career',
  ])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerified404CareersSignal(careers404Html), true)
  assert.equal(hasVerifiedSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(hasVerifiedWebsiteSitemapSignal(websiteSitemapXml), true)
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(careers404Html), false)
  assert.equal(
    isVerifiedNoPublicCareersRoute({
      status: 404,
      url: 'https://wizfreight.com/careers',
      html: careers404Html,
    }),
    true,
  )
})

test('Wiz Frieght scraper returns [] only while the verified homepage, sitemap, and careers 404 contract holds', async () => {
  const wizfrieght = await loadModule()
  assert.ok(wizfrieght, 'Wiz Frieght scraper module should load')

  const {
    CAREERS_ROUTE_URLS,
    HOMEPAGE_URL,
    SITEMAP_INDEX_URL,
    WEBSITE_SITEMAP_URL,
    createWizFrieghtScraper,
  } = wizfrieght

  const requests = []
  const pages = new Map([
    [HOMEPAGE_URL, { status: 200, url: HOMEPAGE_URL, html: homepageHtml }],
    [SITEMAP_INDEX_URL, { status: 200, url: SITEMAP_INDEX_URL, html: sitemapIndexXml }],
    [WEBSITE_SITEMAP_URL, { status: 200, url: WEBSITE_SITEMAP_URL, html: websiteSitemapXml }],
    [CAREERS_ROUTE_URLS[0], { status: 404, url: CAREERS_ROUTE_URLS[0], html: careers404Html }],
    [CAREERS_ROUTE_URLS[1], { status: 404, url: CAREERS_ROUTE_URLS[1], html: careers404Html }],
  ])

  const jobs = await createWizFrieghtScraper().run({
    fetchPage: async (url) => {
      requests.push(url)

      const page = pages.get(url)
      if (!page) {
        throw new Error(`Unexpected URL: ${url}`)
      }

      return page
    },
  })

  assert.deepEqual(requests, [
    HOMEPAGE_URL,
    SITEMAP_INDEX_URL,
    WEBSITE_SITEMAP_URL,
    ...CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Wiz Frieght returns [] when its verified placeholder surfaces are temporarily unreachable from this runtime', async () => {
  const wizfrieght = await loadModule()
  assert.ok(wizfrieght, 'Wiz Frieght scraper module should load')

  assert.equal(
    wizfrieght.isVerifiedWizFrieghtUnavailableError(createUnavailableError()),
    true,
  )

  const jobs = await wizfrieght.createWizFrieghtScraper().run({
    fetchPage: async () => {
      throw createUnavailableError()
    },
  })

  assert.deepEqual(jobs, [])
})

test('Wiz Frieght scraper throws when the careers route starts exposing a public jobs signal', async () => {
  const wizfrieght = await loadModule()
  assert.ok(wizfrieght, 'Wiz Frieght scraper module should load')

  const {
    CAREERS_ROUTE_URLS,
    HOMEPAGE_URL,
    SITEMAP_INDEX_URL,
    WEBSITE_SITEMAP_URL,
    createWizFrieghtScraper,
  } = wizfrieght

  await assert.rejects(
    createWizFrieghtScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === WEBSITE_SITEMAP_URL) {
          return { status: 200, url, html: websiteSitemapXml }
        }

        if (url === CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h1>Careers</h1>
                  <h2>Open Positions</h2>
                  <a href="/jobs/sales-manager-singapore">Apply Now</a>
                </body>
              </html>
            `,
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})
