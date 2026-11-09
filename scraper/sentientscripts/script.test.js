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
  <html lang="en">
    <head>
      <title>Sentient Scripts | AI-driven Business Intelligence</title>
    </head>
    <body>
      <main>
        <h1>Transform Your Data into AI Reality</h1>
        <p>Sentient Scripts was born from a passion for data and a drive for innovation.</p>
        <p>TC9/443, I Lane, Jawahar Nagar, Kowdiar, Thiruvananthapuram, Kerala 695003, India</p>
        <p>info@sentientscripts.com</p>
        <a href="https://www.linkedin.com/company/sentient-scripts/">LinkedIn</a>
        <p>PepHire</p>
      </main>
      <footer>
        <p>© 2025 Sentient Scripts Pvt. Ltd.</p>
      </footer>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
      <loc>https://www.sentientscripts.com/pages-sitemap.xml</loc>
      <lastmod>2026-05-07</lastmod>
    </sitemap>
    <sitemap>
      <loc>https://www.sentientscripts.com/blog-sitemap.xml</loc>
      <lastmod>2026-05-07</lastmod>
    </sitemap>
  </sitemapindex>
`

const pagesSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://www.sentientscripts.com/</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
    <url>
      <loc>https://www.sentientscripts.com/services</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
    <url>
      <loc>https://www.sentientscripts.com/products</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
    <url>
      <loc>https://www.sentientscripts.com/contact-us</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
  </urlset>
`

const currentPagesSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://www.sentientscripts.com/book-online</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
    <url>
      <loc>https://www.sentientscripts.com/pephire</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
    <url>
      <loc>https://www.sentientscripts.com</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
    <url>
      <loc>https://www.sentientscripts.com/contact-us</loc>
      <lastmod>2026-05-07</lastmod>
    </url>
  </urlset>
`

const notFoundHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <main>
        <h1>404 Not Found</h1>
        <p>The page you requested could not be found.</p>
      </main>
    </body>
  </html>
`

test('Sentient Scripts validates the official homepage, sitemap pair, and missing careers routes', async () => {
  const sentientScripts = await loadModule()
  assert.ok(sentientScripts, 'Sentient Scripts scraper module should load')

  assert.equal(sentientScripts.SOURCE, 'sentientscripts')
  assert.equal(sentientScripts.COMPANY, 'SENTIENT SCRIPTS PVT. LTD.')
  assert.equal(sentientScripts.HOMEPAGE_URL, 'https://www.sentientscripts.com/')
  assert.equal(sentientScripts.SITEMAP_URL, 'https://www.sentientscripts.com/sitemap.xml')
  assert.equal(sentientScripts.PAGES_SITEMAP_URL, 'https://www.sentientscripts.com/pages-sitemap.xml')
  assert.deepEqual(sentientScripts.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.sentientscripts.com/careers',
    'https://www.sentientscripts.com/career',
    'https://www.sentientscripts.com/jobs',
    'https://www.sentientscripts.com/join-us',
  ])
  assert.equal(sentientScripts.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sentientScripts.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(sentientScripts.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(sentientScripts.hasVerifiedSitemapIndex(sitemapXml), true)
  assert.equal(sentientScripts.hasVerifiedPagesSitemap(pagesSitemapXml), true)
  assert.equal(
    sentientScripts.isVerifiedMissingCareersRoute({
      status: 404,
      url: sentientScripts.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: notFoundHtml,
    }),
    true,
  )
})

test('Sentient Scripts returns no jobs only while the verified no-public-careers contract remains intact', async () => {
  const sentientScripts = await loadModule()
  assert.ok(sentientScripts, 'Sentient Scripts scraper module should load')

  const requestedUrls = []
  const jobs = await sentientScripts.createSentientScriptsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sentientScripts.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === sentientScripts.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === sentientScripts.PAGES_SITEMAP_URL) {
        return { status: 200, url, html: pagesSitemapXml }
      }

      if (sentientScripts.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sentientScripts.HOMEPAGE_URL,
    sentientScripts.SITEMAP_URL,
    sentientScripts.PAGES_SITEMAP_URL,
    ...sentientScripts.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Sentient Scripts accepts the live pages sitemap when Wix omits the homepage trailing slash', async () => {
  const sentientScripts = await loadModule()
  assert.ok(sentientScripts, 'Sentient Scripts scraper module should load')

  assert.equal(sentientScripts.hasVerifiedPagesSitemap(currentPagesSitemapXml), true)
})

test('Sentient Scripts fails closed when the homepage, sitemap, or careers-route contract changes', async () => {
  const sentientScripts = await loadModule()
  assert.ok(sentientScripts, 'Sentient Scripts scraper module should load')

  await assert.rejects(
    sentientScripts.createSentientScriptsScraper().run({
      fetchPage: async (url) => {
        if (url === sentientScripts.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }
        if (url === sentientScripts.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === sentientScripts.PAGES_SITEMAP_URL) {
          return { status: 200, url, html: pagesSitemapXml }
        }
        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    sentientScripts.createSentientScriptsScraper().run({
      fetchPage: async (url) => {
        if (url === sentientScripts.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === sentientScripts.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === sentientScripts.PAGES_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://www.sentientscripts.com/careers</loc></url>
              </urlset>
            `,
          }
        }
        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /verified pages sitemap/i,
  )

  await assert.rejects(
    sentientScripts.createSentientScriptsScraper().run({
      fetchPage: async (url) => {
        if (url === sentientScripts.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === sentientScripts.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === sentientScripts.PAGES_SITEMAP_URL) {
          return { status: 200, url, html: pagesSitemapXml }
        }
        if (url === sentientScripts.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }
        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
