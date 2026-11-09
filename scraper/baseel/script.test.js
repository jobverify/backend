import assert from 'node:assert/strict'
import test from 'node:test'

const baseelDotComHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Professional IT Consultant for Your Business - Baseel Partners LLP.</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/about-us">About Us</a>
        <a href="/services">Services</a>
        <a href="/products">Products</a>
        <a href="/industries">Industries</a>
        <a href="/hosting">Hosting</a>
        <a href="/csr">CSR</a>
        <a href="/blogs">Blogs</a>
        <a href="/contact-us">Contact Us</a>
        <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </header>
    <main>
      <h2>OUR NEWSLETTER</h2>
      <p>We summarise the key information for you in our InfoSec and Data Protection Newsletters.</p>
      <h3>GET TO KNOW US</h3>
      <h3>OUR POLICIES</h3>
      <p>Students and recent graduates who want to pursue a career in digital forensics.</p>
      <p>167-169 Great Portland Street, London, W1W 5PF</p>
      <p>contactus@baseel.com</p>
    </main>
    <script src="/_next/static/chunks/main-app-f3336e172256d2ab.js"></script>
    <script src="/_next/static/chunks/app/layout-ff166de292dabf37.js"></script>
  </body>
</html>
`

const baseelDotInHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Data Privacy &amp; Compliance Automation Platform | Baseel</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/about">About Us</a>
        <a href="/resources">Resources</a>
        <a href="/contact">Contact Us</a>
        <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </header>
    <main>
      <p>India's DPDP Act Compliance Platform</p>
      <h1>DPDP Compliance Made Simple</h1>
      <h2>Why Baseel Group?</h2>
      <a href="/demo">Get Demo</a>
      <p>IND: +91 85888 69120</p>
      <p>contactus@baseel.com</p>
    </main>
    <script src="/_next/static/chunks/main-app-2ecc3bf42ae2d122.js"></script>
    <script src="/_next/static/chunks/app/layout-2395caeeff92dfdb.js"></script>
  </body>
</html>
`

const baseelDotComSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://baseel.com</loc></url>
  <url><loc>https://baseel.com/about-us</loc></url>
  <url><loc>https://baseel.com/blogs</loc></url>
</urlset>
`

const baseelDotInSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://baseel.in</loc></url>
  <url><loc>https://baseel.in/about</loc></url>
  <url><loc>https://baseel.in/resources</loc></url>
</urlset>
`

const verifiedBaseelDotComBundleJs = `
self.__next_f.push([]);
const nav = ["/about-us", "/blogs", "/contact-us"];
const sharedEmail = "contactus@baseel.com";
`

const verifiedBaseelDotInBundleJs = `
self.__next_f.push([]);
const nav = ["/about", "/resources", "/contact"];
const heroCta = "Get Demo";
`

const publicJobsBundleJs = `
const routes = ["/careers", "/jobs"];
const board = "https://jobs.lever.co/baseel/privacy-consultant";
const cta = "Apply now";
`

const publicJobsRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BASEEL Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/baseel/privacy-consultant">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('BASEEL sentinel recognizes the verified dual-domain homepages, sitemaps, bundles, and route fallback shells', async () => {
  const baseel = await loadModule()
  assert.ok(baseel, 'Expected BASEEL scraper module at ./script.js')

  assert.equal(baseel.SOURCE, 'baseel')
  assert.equal(baseel.COMPANY, 'BASEEL')
  assert.equal(baseel.SHARED_CONTACT_EMAIL, 'contactus@baseel.com')
  assert.equal(baseel.BASEEL_DOT_COM.homepageUrl, 'https://baseel.com/')
  assert.equal(baseel.BASEEL_DOT_COM.sitemapUrl, 'https://baseel.com/sitemap.xml')
  assert.deepEqual(baseel.BASEEL_DOT_COM.routeUrls, [
    'https://baseel.com/careers',
    'https://baseel.com/careers/',
    'https://baseel.com/career',
    'https://baseel.com/career/',
    'https://baseel.com/jobs',
    'https://baseel.com/jobs/',
    'https://baseel.com/join-us',
    'https://baseel.com/join-us/',
  ])
  assert.equal(baseel.BASEEL_DOT_IN.homepageUrl, 'https://baseel.in/')
  assert.equal(baseel.BASEEL_DOT_IN.sitemapUrl, 'https://baseel.in/sitemap.xml')
  assert.deepEqual(baseel.BASEEL_DOT_IN.routeUrls, [
    'https://baseel.in/careers',
    'https://baseel.in/careers/',
    'https://baseel.in/career',
    'https://baseel.in/career/',
    'https://baseel.in/jobs',
    'https://baseel.in/jobs/',
    'https://baseel.in/join-us',
    'https://baseel.in/join-us/',
  ])

  assert.equal(baseel.hasBaseelDotComHomepageSignal(baseelDotComHomepageHtml), true)
  assert.equal(baseel.hasBaseelDotInHomepageSignal(baseelDotInHomepageHtml), true)
  assert.equal(baseel.hasPublicJobsTextSignal(baseelDotComHomepageHtml), false)
  assert.equal(baseel.hasUnexpectedCareerOrAtsLink(baseelDotComHomepageHtml, baseel.BASEEL_DOT_COM.homepageUrl), false)
  assert.equal(baseel.hasUnexpectedCareerOrAtsLink(baseelDotInHomepageHtml, baseel.BASEEL_DOT_IN.homepageUrl), false)
  assert.deepEqual(
    baseel.extractFirstPartyScriptUrls(baseelDotComHomepageHtml, baseel.BASEEL_DOT_COM.homepageUrl),
    [
      'https://baseel.com/_next/static/chunks/main-app-f3336e172256d2ab.js',
      'https://baseel.com/_next/static/chunks/app/layout-ff166de292dabf37.js',
    ],
  )
  assert.deepEqual(
    baseel.extractFirstPartyScriptUrls(baseelDotInHomepageHtml, baseel.BASEEL_DOT_IN.homepageUrl),
    [
      'https://baseel.in/_next/static/chunks/main-app-2ecc3bf42ae2d122.js',
      'https://baseel.in/_next/static/chunks/app/layout-2395caeeff92dfdb.js',
    ],
  )
  assert.equal(baseel.hasBundleJobsSignal(verifiedBaseelDotComBundleJs), false)
  assert.equal(baseel.hasBundleJobsSignal(verifiedBaseelDotInBundleJs), false)
  assert.equal(baseel.hasBundleJobsSignal(publicJobsBundleJs), true)
  assert.equal(baseel.sitemapHasHomepageEntry(baseelDotComSitemapXml, baseel.BASEEL_DOT_COM.homepageUrl), true)
  assert.equal(baseel.sitemapHasHomepageEntry(baseelDotInSitemapXml, baseel.BASEEL_DOT_IN.homepageUrl), true)
  assert.equal(baseel.sitemapHasCareerLikeUrl(baseelDotComSitemapXml), false)
  assert.equal(baseel.sitemapHasCareerLikeUrl(baseelDotInSitemapXml), false)
  assert.equal(
    baseel.isVerifiedRouteFallbackShell(
      baseelDotComHomepageHtml,
      baseelDotComHomepageHtml,
      baseel.BASEEL_DOT_COM.homepageUrl,
    ),
    true,
  )
  assert.equal(
    baseel.isVerifiedRouteFallbackShell(
      baseelDotInHomepageHtml,
      baseelDotInHomepageHtml,
      baseel.BASEEL_DOT_IN.homepageUrl,
    ),
    true,
  )
})

test('BASEEL sentinel returns no jobs only while both verified first-party surfaces remain unchanged', async () => {
  const baseel = await loadModule()
  assert.ok(baseel, 'Expected BASEEL scraper module at ./script.js')

  const requestedPageUrls = []
  const requestedTextUrls = []

  const jobs = await baseel.createBaseelScraper().run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
        return { status: 200, url, html: baseelDotComHomepageHtml }
      }
      if (url === baseel.BASEEL_DOT_COM.sitemapUrl) {
        return { status: 200, url, html: baseelDotComSitemapXml }
      }
      if (baseel.BASEEL_DOT_COM.routeUrls.includes(url)) {
        return { status: 200, url, html: baseelDotComHomepageHtml }
      }

      if (url === baseel.BASEEL_DOT_IN.homepageUrl) {
        return { status: 200, url, html: baseelDotInHomepageHtml }
      }
      if (url === baseel.BASEEL_DOT_IN.sitemapUrl) {
        return { status: 200, url, html: baseelDotInSitemapXml }
      }
      if (baseel.BASEEL_DOT_IN.routeUrls.includes(url)) {
        return { status: 200, url, html: baseelDotInHomepageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === 'https://baseel.com/_next/static/chunks/main-app-f3336e172256d2ab.js') {
        return verifiedBaseelDotComBundleJs
      }
      if (url === 'https://baseel.com/_next/static/chunks/app/layout-ff166de292dabf37.js') {
        return verifiedBaseelDotComBundleJs
      }
      if (url === 'https://baseel.in/_next/static/chunks/main-app-2ecc3bf42ae2d122.js') {
        return verifiedBaseelDotInBundleJs
      }
      if (url === 'https://baseel.in/_next/static/chunks/app/layout-2395caeeff92dfdb.js') {
        return verifiedBaseelDotInBundleJs
      }

      throw new Error(`Unexpected bundle URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    baseel.BASEEL_DOT_COM.homepageUrl,
    baseel.BASEEL_DOT_COM.sitemapUrl,
    ...baseel.BASEEL_DOT_COM.routeUrls,
    baseel.BASEEL_DOT_IN.homepageUrl,
    baseel.BASEEL_DOT_IN.sitemapUrl,
    ...baseel.BASEEL_DOT_IN.routeUrls,
  ])
  assert.deepEqual(requestedTextUrls, [
    'https://baseel.com/_next/static/chunks/main-app-f3336e172256d2ab.js',
    'https://baseel.com/_next/static/chunks/app/layout-ff166de292dabf37.js',
    'https://baseel.in/_next/static/chunks/main-app-2ecc3bf42ae2d122.js',
    'https://baseel.in/_next/static/chunks/app/layout-2395caeeff92dfdb.js',
  ])
  assert.deepEqual(jobs, [])
})

test('BASEEL sentinel fails closed when a homepage, sitemap, bundle, or checked route starts exposing public jobs', async () => {
  const baseel = await loadModule()
  assert.ok(baseel, 'Expected BASEEL scraper module at ./script.js')

  await assert.rejects(
    baseel.createBaseelScraper().run({
      fetchPage: async (url) => {
        if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => verifiedBaseelDotComBundleJs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    baseel.createBaseelScraper().run({
      fetchPage: async (url) => {
        if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
          return {
            status: 200,
            url,
            html: baseelDotComHomepageHtml.replace(
              '<a href="/about-us">About Us</a>',
              '<a href="/careers">Careers</a>',
            ),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => verifiedBaseelDotComBundleJs,
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    baseel.createBaseelScraper().run({
      fetchPage: async (url) => {
        if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
          return { status: 200, url, html: baseelDotComHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_COM.sitemapUrl) {
          return {
            status: 200,
            url,
            html: baseelDotComSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://baseel.com/careers</loc></url></urlset>',
            ),
          }
        }
        if (baseel.BASEEL_DOT_COM.routeUrls.includes(url)) {
          return { status: 200, url, html: baseelDotComHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_IN.homepageUrl) {
          return { status: 200, url, html: baseelDotInHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_IN.sitemapUrl) {
          return { status: 200, url, html: baseelDotInSitemapXml }
        }
        if (baseel.BASEEL_DOT_IN.routeUrls.includes(url)) {
          return { status: 200, url, html: baseelDotInHomepageHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async (url) => (
        url.includes('baseel.com')
          ? verifiedBaseelDotComBundleJs
          : verifiedBaseelDotInBundleJs
      ),
    }),
    /sitemap no longer matches/i,
  )

  await assert.rejects(
    baseel.createBaseelScraper().run({
      fetchPage: async (url) => {
        if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
          return { status: 200, url, html: baseelDotComHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_COM.sitemapUrl) {
          return { status: 200, url, html: baseelDotComSitemapXml }
        }
        if (baseel.BASEEL_DOT_COM.routeUrls.includes(url)) {
          return { status: 200, url, html: baseelDotComHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_IN.homepageUrl) {
          return { status: 200, url, html: baseelDotInHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_IN.sitemapUrl) {
          return { status: 200, url, html: baseelDotInSitemapXml }
        }
        if (baseel.BASEEL_DOT_IN.routeUrls.includes(url)) {
          return { status: 200, url, html: baseelDotInHomepageHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async (url) => (
        url.includes('main-app-f3336e172256d2ab')
          ? publicJobsBundleJs
          : url.includes('baseel.com')
            ? verifiedBaseelDotComBundleJs
            : verifiedBaseelDotInBundleJs
      ),
    }),
    /client bundle now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    baseel.createBaseelScraper().run({
      fetchPage: async (url) => {
        if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
          return { status: 200, url, html: baseelDotComHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_COM.sitemapUrl) {
          return { status: 200, url, html: baseelDotComSitemapXml }
        }
        if (url === baseel.BASEEL_DOT_COM.routeUrls[0]) {
          return { status: 200, url, html: publicJobsRouteHtml }
        }
        if (baseel.BASEEL_DOT_COM.routeUrls.slice(1).includes(url)) {
          return { status: 200, url, html: baseelDotComHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_IN.homepageUrl) {
          return { status: 200, url, html: baseelDotInHomepageHtml }
        }
        if (url === baseel.BASEEL_DOT_IN.sitemapUrl) {
          return { status: 200, url, html: baseelDotInSitemapXml }
        }
        if (baseel.BASEEL_DOT_IN.routeUrls.includes(url)) {
          return { status: 200, url, html: baseelDotInHomepageHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async (url) => (
        url.includes('baseel.com')
          ? verifiedBaseelDotComBundleJs
          : verifiedBaseelDotInBundleJs
      ),
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
