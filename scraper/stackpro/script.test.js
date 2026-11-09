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
  <!DOCTYPE html>
  <html>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width" />
      <link rel="stylesheet" href="/_next/static/css/68ac4c59e52b5fdf.css" />
      <script src="/_next/static/chunks/main-6ab3a201dd2e316e.js" defer></script>
      <script src="/_next/static/chunks/pages/index-4b563389f41781ea.js" defer></script>
    </head>
    <body>
      <div id="__next"><div>Loading...</div></div>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{}},"page":"/","query":{},"buildId":"rLcaiZPpMmSuoFyTJTcQc","nextExport":true,"autoExport":true,"isFallback":false,"scriptLoader":[]}
      </script>
    </body>
  </html>
`

const aboutHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script src="/_next/static/chunks/pages/about-4e48f1abde1033ca.js" defer></script>
    </head>
    <body>
      <div id="__next"><div>Loading...</div></div>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{}},"page":"/about","query":{},"buildId":"rLcaiZPpMmSuoFyTJTcQc","nextExport":true,"autoExport":true,"isFallback":false,"scriptLoader":[]}
      </script>
    </body>
  </html>
`

const contactHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script src="/_next/static/chunks/pages/contact-37305ea8f8c4b9da.js" defer></script>
    </head>
    <body>
      <div id="__next"><div>Loading...</div></div>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{}},"page":"/contact","query":{},"buildId":"rLcaiZPpMmSuoFyTJTcQc","nextExport":true,"autoExport":true,"isFallback":false,"scriptLoader":[]}
      </script>
    </body>
  </html>
`

const robotsTxt = `
User-agent: *
Allow: /

# keep private app areas out of the index
Disallow: /dashboard
Disallow: /onboarding
Disallow: /api/

Sitemap: https://stackpro.io/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://stackpro.io/</loc></url>
  <url><loc>https://stackpro.io/features</loc></url>
  <url><loc>https://stackpro.io/pricing</loc></url>
  <url><loc>https://stackpro.io/support</loc></url>
  <url><loc>https://stackpro.io/contact</loc></url>
  <url><loc>https://stackpro.io/industries/law-firms</loc></url>
  <url><loc>https://stackpro.io/industries/contractors</loc></url>
  <url><loc>https://stackpro.io/industries/marketing-agencies</loc></url>
  <url><loc>https://stackpro.io/industries/creative-agencies</loc></url>
  <url><loc>https://stackpro.io/try</loc></url>
  <url><loc>https://stackpro.io/agents/how-it-works</loc></url>
  <url><loc>https://stackpro.io/privacy</loc></url>
  <url><loc>https://stackpro.io/terms</loc></url>
</urlset>
`

const homepageBundleText = `
  const meta = {
    canonical: "https://stackpro.io",
    title: "StackPro - Complete Business Stack",
    keywords: "business platform, CRM, website builder, client portal, AI assistant, small business software, AI agents, automation"
  };
  const nav = ["StackPro", "/support", "/contact", "Creative Agencies", "Marketing Agencies"];
  console.log(meta, nav);
`

const contactBundleText = `
  const contactSeo = "Get in touch with StackPro for demos, support, or questions. Email: support@stackpro.io. Professional business tools for law firms, real estate, and consultants.";
  const hero = ["StackPro", "support@stackpro.io", "/contact"];
  console.log(contactSeo, hero);
`

test('StackPro sentinel validates the verified homepage shell, official routes, robots, sitemap, and missing careers fallbacks', async () => {
  const stackpro = await loadModule()
  assert.ok(stackpro, 'StackPro scraper module should load')

  assert.equal(stackpro.SOURCE, 'stackpro')
  assert.equal(stackpro.COMPANY, 'StackPro')
  assert.equal(stackpro.HOMEPAGE_URL, 'https://stackpro.io/')
  assert.equal(stackpro.ABOUT_URL, 'https://stackpro.io/about')
  assert.equal(stackpro.CONTACT_URL, 'https://stackpro.io/contact')
  assert.equal(stackpro.ROBOTS_URL, 'https://stackpro.io/robots.txt')
  assert.equal(stackpro.SITEMAP_URL, 'https://stackpro.io/sitemap.xml')
  assert.deepEqual(stackpro.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://stackpro.io/careers',
    'https://stackpro.io/jobs',
  ])

  assert.equal(stackpro.extractNextDataPage(homepageHtml), '/')
  assert.equal(stackpro.extractNextDataPage(aboutHtml), '/about')
  assert.equal(stackpro.extractNextDataPage(contactHtml), '/contact')
  assert.equal(
    stackpro.extractPageBundleAssetPath(homepageHtml, 'index'),
    '/_next/static/chunks/pages/index-4b563389f41781ea.js',
  )
  assert.equal(
    stackpro.extractPageBundleAssetPath(aboutHtml, 'about'),
    '/_next/static/chunks/pages/about-4e48f1abde1033ca.js',
  )
  assert.equal(
    stackpro.extractPageBundleAssetPath(contactHtml, 'contact'),
    '/_next/static/chunks/pages/contact-37305ea8f8c4b9da.js',
  )
  assert.equal(stackpro.hasVerifiedHomepageBundleIdentity(homepageBundleText), true)
  assert.equal(stackpro.hasVerifiedContactBundleIdentity(contactBundleText), true)
  assert.equal(stackpro.hasBundleJobsSignal(homepageBundleText), false)
  assert.equal(stackpro.hasBundleJobsSignal(contactBundleText), false)
  assert.equal(stackpro.hasVerifiedRobotsTxt(robotsTxt), true)
  assert.equal(stackpro.hasVerifiedSitemap(sitemapXml), true)
  assert.equal(
    stackpro.isVerifiedRoutePage(
      { status: 200, url: stackpro.HOMEPAGE_URL, html: homepageHtml },
      '/',
      'index',
    ),
    true,
  )
  assert.equal(
    stackpro.isVerifiedRoutePage(
      { status: 200, url: `${stackpro.ABOUT_URL}/`, html: aboutHtml },
      '/about',
      'about',
    ),
    true,
  )
  assert.equal(
    stackpro.isVerifiedRoutePage(
      { status: 200, url: `${stackpro.CONTACT_URL}/`, html: contactHtml },
      '/contact',
      'contact',
    ),
    true,
  )
  assert.equal(
    stackpro.isVerifiedMissingCareersRoute(
      { status: 404, url: 'https://stackpro.io/careers/', html: homepageHtml },
      homepageHtml,
    ),
    true,
  )
})

test('StackPro returns no jobs only while the verified first-party public surface stays careers-free', async () => {
  const stackpro = await loadModule()
  assert.ok(stackpro, 'StackPro scraper module should load')

  const requestedUrls = []
  const jobs = await stackpro.createStackproScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === stackpro.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === stackpro.ABOUT_URL) {
        return { status: 200, url: `${url}/`, html: aboutHtml }
      }

      if (url === stackpro.CONTACT_URL) {
        return { status: 200, url: `${url}/`, html: contactHtml }
      }

      if (stackpro.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url: `${url}/`, html: homepageHtml }
      }

      throw new Error(`Unexpected fixture page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === stackpro.ROBOTS_URL) return robotsTxt
      if (url === stackpro.SITEMAP_URL) return sitemapXml
      if (url === 'https://stackpro.io/_next/static/chunks/pages/index-4b563389f41781ea.js') {
        return homepageBundleText
      }
      if (url === 'https://stackpro.io/_next/static/chunks/pages/contact-37305ea8f8c4b9da.js') {
        return contactBundleText
      }

      throw new Error(`Unexpected fixture text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    stackpro.HOMEPAGE_URL,
    stackpro.ABOUT_URL,
    stackpro.CONTACT_URL,
    stackpro.ROBOTS_URL,
    stackpro.SITEMAP_URL,
    'https://stackpro.io/_next/static/chunks/pages/index-4b563389f41781ea.js',
    'https://stackpro.io/_next/static/chunks/pages/contact-37305ea8f8c4b9da.js',
    ...stackpro.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('StackPro fails closed when the official public surface starts exposing careers drift', async () => {
  const stackpro = await loadModule()
  assert.ok(stackpro, 'StackPro scraper module should load')

  await assert.rejects(
    stackpro.createStackproScraper().run({
      fetchPage: async (url) => {
        if (url === stackpro.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected shell</h1></body></html>' }
        }
        return { status: 200, url, html: homepageHtml }
      },
      fetchText: async (url) => {
        if (url === stackpro.ROBOTS_URL) return robotsTxt
        if (url === stackpro.SITEMAP_URL) return sitemapXml
        return homepageBundleText
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    stackpro.createStackproScraper().run({
      fetchPage: async (url) => {
        if (url === stackpro.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === stackpro.ABOUT_URL) return { status: 200, url: `${url}/`, html: aboutHtml }
        if (url === stackpro.CONTACT_URL) return { status: 200, url: `${url}/`, html: contactHtml }
        if (stackpro.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url: `${url}/`,
            html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === stackpro.ROBOTS_URL) return robotsTxt
        if (url === stackpro.SITEMAP_URL) return sitemapXml
        if (url === 'https://stackpro.io/_next/static/chunks/pages/index-4b563389f41781ea.js') {
          return homepageBundleText
        }
        return contactBundleText
      },
    }),
    /checked careers routes changed materially or now expose public jobs/i,
  )

  await assert.rejects(
    stackpro.createStackproScraper().run({
      fetchPage: async (url) => {
        if (url === stackpro.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === stackpro.ABOUT_URL) return { status: 200, url: `${url}/`, html: aboutHtml }
        if (url === stackpro.CONTACT_URL) return { status: 200, url: `${url}/`, html: contactHtml }
        if (stackpro.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url: `${url}/`, html: homepageHtml }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === stackpro.ROBOTS_URL) return robotsTxt
        if (url === stackpro.SITEMAP_URL) {
          return `${sitemapXml}<url><loc>https://stackpro.io/careers</loc></url>`
        }
        if (url === 'https://stackpro.io/_next/static/chunks/pages/index-4b563389f41781ea.js') {
          return `${homepageBundleText} "/careers"`
        }
        return contactBundleText
      },
    }),
    /bundle changed materially or now exposes public jobs|sitemap changed materially or now lists public careers/i,
  )
})
