import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Nagoba Electronics | ACCL, Earth Leakage Relay , Earth Fault Relay &amp; more.</title>
    <meta
      name="description"
      content="Leading manufacturer of ACCL &amp; Relays in India. ACCL is used to seamlessly switch between main &amp; generator supplies during power interruptions.. Get in touch with us for more information."
    />
    <link rel="canonical" href="https://nagoba.com/" />
    <meta property="og:site_name" content="Nagoba Electronics" />
  </head>
  <body>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","url":"https://nagoba.com/","name":"Nagoba Electronics"}
    </script>
    <nav>
      <a href="#home">Home</a>
      <a href="#sbc">Products</a>
      <a href="#contactus">Contact</a>
    </nav>
    <main>
      <h1>PRODUCTS</h1>
      <p>Installed Products</p>
      <p>Builders</p>
      <p>Cities</p>
      <p>Customers</p>
      <a href="mailto:contact@nagoba.com">contact@nagoba.com</a>
      <a href="mailto:sales@nagoba.com">sales@nagoba.com</a>
      <p>11/32, Byraveshwara Industrial Estate, Near Peenya 2nd Stage, Bengaluru 560091</p>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://nagoba.com/</loc>
    <lastmod>2018-04-28T15:41:11+05:00</lastmod>
  </url>
</urlset>
`

const missingCareersPage = {
  status: 404,
  url: 'https://nagoba.com/careers',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Page not found | Nagoba Electronics</title>
        <meta name="robots" content="noindex,follow" />
      </head>
      <body class="error404 sh-body-header-sticky sh-blog-style2">
        <nav>
          <a href="#home">Home</a>
          <a href="#sbc">Products</a>
          <a href="#contactus">Contact</a>
        </nav>
        <h2>Page could not be found</h2>
        <div id="breadcrumbs">
          <a href="https://nagoba.com/" title="Home">Home</a>
          <span>Error 404</span>
        </div>
        <div id="sh-404">
          <h3>Oops, This Page Could Not Be Found!</h3>
          <p>
            The page you are looking for might have been removed, had its name changed, or is
            temporarily unavailable.
          </p>
        </div>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Nagoba Electronics sentinel recognizes the verified homepage, page sitemap, and missing careers shell', async () => {
  const nagoba = await loadModule()
  assert.ok(nagoba, 'Expected scraper module at ./script.js')

  assert.equal(nagoba.SOURCE, 'nagobaelectronics')
  assert.equal(nagoba.COMPANY, 'Nagoba Electronics')
  assert.equal(nagoba.HOMEPAGE_URL, 'https://nagoba.com/')
  assert.equal(nagoba.PAGE_SITEMAP_URL, 'https://nagoba.com/page-sitemap.xml')
  assert.deepEqual(nagoba.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://nagoba.com/careers',
    'https://nagoba.com/careers/',
    'https://nagoba.com/career',
    'https://nagoba.com/career/',
    'https://nagoba.com/jobs',
    'https://nagoba.com/jobs/',
    'https://nagoba.com/job',
    'https://nagoba.com/job/',
    'https://nagoba.com/work-with-us',
    'https://nagoba.com/work-with-us/',
    'https://nagoba.com/join-us',
    'https://nagoba.com/join-us/',
  ])

  assert.equal(nagoba.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nagoba.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(nagoba.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(nagoba.isVerifiedPageSitemap(sitemapXml), true)
  assert.equal(nagoba.isVerifiedMissingCareersRoute(missingCareersPage), true)
})

test('Nagoba Electronics sentinel returns no jobs only while the verified first-party surface exposes no public careers board', async () => {
  const nagoba = await loadModule()
  assert.ok(nagoba, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await nagoba.createNagobaElectronicsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nagoba.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === nagoba.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (nagoba.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { ...missingCareersPage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nagoba.HOMEPAGE_URL,
    nagoba.PAGE_SITEMAP_URL,
    ...nagoba.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Nagoba Electronics sentinel fails closed when the verified public surface drifts', async () => {
  const nagoba = await loadModule()
  assert.ok(nagoba, 'Expected scraper module at ./script.js')

  await assert.rejects(
    nagoba.createNagobaElectronicsScraper().run({
      fetchPage: async (url) => {
        if (url === nagoba.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    nagoba.createNagobaElectronicsScraper().run({
      fetchPage: async (url) => {
        if (url === nagoba.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers path/i,
  )

  await assert.rejects(
    nagoba.createNagobaElectronicsScraper().run({
      fetchPage: async (url) => {
        if (url === nagoba.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === nagoba.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://nagoba.com/careers</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap/i,
  )

  await assert.rejects(
    nagoba.createNagobaElectronicsScraper().run({
      fetchPage: async (url) => {
        if (url === nagoba.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === nagoba.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === nagoba.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current Openings</p></body></html>',
          }
        }

        if (nagoba.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { ...missingCareersPage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )
})
