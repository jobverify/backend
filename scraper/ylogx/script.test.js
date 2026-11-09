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
      <title>YlogX - AI-Driven Digital Transformation</title>
      <script type="module" crossorigin src="/assets/index-B4ZDnGNR.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const hydratedHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>YlogX - AI-Driven Digital Transformation</title>
      <script type="module" crossorigin src="/assets/index-C-gnE1iz.js"></script>
    </head>
    <body>
      <div id="root">
        <nav aria-label="Insights">
          <h2>Insights</h2>
          <ul>
            <li><a href="https://ylogx.io/blogs/agentic-ai-for-enterprise-the-complete-guide">Agentic AI for Enterprise</a></li>
          </ul>
        </nav>
      </div>
    </body>
  </html>
`

const sitemapXml = `
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://ylogx.io/</loc></url>
    <url><loc>https://ylogx.io/blogs</loc></url>
    <url><loc>https://ylogx.io/blogs/medium</loc></url>
    <url><loc>https://ylogx.io/casestudies</loc></url>
    <url><loc>https://ylogx.io/capabilities</loc></url>
    <url><loc>https://ylogx.io/solutions</loc></url>
    <url><loc>https://ylogx.io/contact</loc></url>
    <url><loc>https://ylogx.io/team</loc></url>
    <url><loc>https://ylogx.io/faq</loc></url>
  </urlset>
`

const bundleText = `
  const routes = [
    { path: "/", component: "Home" },
    { path: "/blogs", component: "Blogs" },
    { path: "/casestudies", component: "CaseStudies" },
    { path: "/capabilities", component: "Capabilities" },
    { path: "/solutions", component: "Solutions" },
    { path: "/contact", component: "Contact" },
    { path: "/team", component: "Team" },
    { path: "/faq", component: "Faq" },
    { path: "*", lazy: () => import("./NotFound-Bcy7mi-x.js") }
  ];
  const apis = ["/api/blogs", "/api/blog-list-seo", "/api/faq-items", "/api/site-settings", "/api/chatbot/ask"];
  console.log("YlogX", routes, apis);
`

test('YlogX validates the canonical homepage, sitemap, bundle identity, and route fallback contract', async () => {
  const ylogx = await loadModule()
  assert.ok(ylogx, 'YlogX scraper module should load')

  assert.equal(ylogx.SOURCE, 'ylogx')
  assert.equal(ylogx.COMPANY, 'YlogX')
  assert.equal(ylogx.LEGACY_HOMEPAGE_URL, 'https://www.ylogx.co.in/')
  assert.equal(ylogx.HOMEPAGE_URL, 'https://ylogx.io/')
  assert.equal(ylogx.SITEMAP_URL, 'https://ylogx.io/sitemap.xml')
  assert.deepEqual(ylogx.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://ylogx.io/careers',
    'https://ylogx.io/jobs',
  ])
  assert.equal(ylogx.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ylogx.hasOfficialHomepageSignal(hydratedHomepageHtml), true)
  assert.equal(ylogx.extractMainBundleAssetPath(homepageHtml), '/assets/index-B4ZDnGNR.js')
  assert.equal(ylogx.extractMainBundleAssetPath(hydratedHomepageHtml), '/assets/index-C-gnE1iz.js')
  assert.equal(ylogx.hasVerifiedSitemap(sitemapXml), true)
  assert.equal(ylogx.hasVerifiedBundleIdentity(bundleText), true)
  assert.equal(ylogx.hasBundleJobsSignal(bundleText), false)
  assert.equal(
    ylogx.isVerifiedRouteFallbackShell({
      status: 200,
      url: ylogx.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: homepageHtml,
    }, homepageHtml, '/assets/index-B4ZDnGNR.js'),
    true,
  )
})

test('YlogX returns no jobs only while the verified SPA shell contract remains intact', async () => {
  const ylogx = await loadModule()
  assert.ok(ylogx, 'YlogX scraper module should load')

  const requestedUrls = []
  const jobs = await ylogx.createYlogxScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === ylogx.LEGACY_HOMEPAGE_URL) {
        return { status: 200, url: ylogx.HOMEPAGE_URL, html: homepageHtml }
      }
      if (url === ylogx.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (url === 'https://ylogx.io/assets/index-B4ZDnGNR.js') {
        return { status: 200, url, html: bundleText }
      }
      if (ylogx.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageHtml }
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ylogx.LEGACY_HOMEPAGE_URL,
    ylogx.SITEMAP_URL,
    'https://ylogx.io/assets/index-B4ZDnGNR.js',
    ...ylogx.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('YlogX fails closed when the redirect, sitemap, bundle, or route fallback contract changes', async () => {
  const ylogx = await loadModule()
  assert.ok(ylogx, 'YlogX scraper module should load')

  await assert.rejects(
    ylogx.createYlogxScraper().run({
      fetchPage: async (url) => {
        if (url === ylogx.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: 'https://example.com/', html: homepageHtml }
        }
        return { status: 200, url, html: homepageHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    ylogx.createYlogxScraper().run({
      fetchPage: async (url) => {
        if (url === ylogx.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: ylogx.HOMEPAGE_URL, html: homepageHtml }
        }
        if (url === ylogx.SITEMAP_URL) {
          return { status: 200, url, html: `${sitemapXml}<url><loc>https://ylogx.io/careers</loc></url>` }
        }
        return { status: 200, url, html: bundleText }
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    ylogx.createYlogxScraper().run({
      fetchPage: async (url) => {
        if (url === ylogx.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: ylogx.HOMEPAGE_URL, html: homepageHtml }
        }
        if (url === ylogx.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === 'https://ylogx.io/assets/index-B4ZDnGNR.js') {
          return { status: 200, url, html: `${bundleText}\nconst applyUrl = "jobs.lever.co/ylogx";` }
        }
        return { status: 200, url, html: homepageHtml }
      },
    }),
    /client bundle changed materially or now exposes a public jobs surface/i,
  )

  await assert.rejects(
    ylogx.createYlogxScraper().run({
      fetchPage: async (url) => {
        if (url === ylogx.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: ylogx.HOMEPAGE_URL, html: homepageHtml }
        }
        if (url === ylogx.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === 'https://ylogx.io/assets/index-B4ZDnGNR.js') {
          return { status: 200, url, html: bundleText }
        }
        return {
          status: 200,
          url,
          html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
        }
      },
    }),
    /checked first-party routes changed materially or now expose public jobs/i,
  )
})
