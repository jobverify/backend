import assert from 'node:assert/strict'
import test from 'node:test'

const BASEEL_DOT_COM_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Professional IT Consultant for Your Business - Baseel Partners LLP.</title>
    <link rel="canonical" href="https://baseel.com" />
  </head>
  <body>
    <header><a href="/about">About Us</a></header>
    <main>
      <p>OUR NEWSLETTER</p>
      <p>GET TO KNOW US</p>
      <p>OUR POLICIES</p>
      <p>167-169 Great Portland Street, London, W1W 5PF</p>
      <a href="mailto:contactus@baseel.com">contactus@baseel.com</a>
    </main>
    <footer><a href="/sitemap.xml">Sitemap</a></footer>
    <script src="/_next/static/baseel-com.js"></script>
  </body>
</html>
`

const BASEEL_DOT_COM_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Professional IT Consultant for Your Business - Baseel Partners LLP.</title>
    <link rel="preconnect" href="https://cms-prod.baseel.com" />
    <link rel="canonical" href="https://baseel.com" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <header><a href="/about">About Us</a></header>
    <main>
      <p>OUR NEWSLETTER</p>
      <p>GET TO KNOW US</p>
      <p>OUR POLICIES</p>
      <p>167-169 Great Portland Street, London, W1W 5PF</p>
      <a href="mailto:contactus@baseel.com">contactus@baseel.com</a>
    </main>
    <footer><a href="/sitemap.xml">Sitemap</a></footer>
    <script src="/_next/static/baseel-com.js"></script>
  </body>
</html>
`

const BASEEL_DOT_IN_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Data Privacy & Compliance Automation Platform | Baseel</title>
    <link rel="canonical" href="https://baseel.in/undefined" />
  </head>
  <body>
    <main>
      <p>India's DPDP Act Compliance Platform</p>
      <p>DPDP Compliance Made Simple</p>
      <p>Why Baseel Group?</p>
      <p>Get Demo</p>
      <a href="mailto:contactus@baseel.com">contactus@baseel.com</a>
    </main>
    <footer><a href="/sitemap.xml">Sitemap</a></footer>
    <script src="/_next/static/baseel-in.js"></script>
  </body>
</html>
`

const BASEEL_SITEMAP_XML = (homepageUrl) => `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${homepageUrl}</loc></url>
</urlset>
`

const loadBaseelModule = async () => {
  try {
    return await import('../../scraper/baseel/script.js')
  } catch {
    assert.fail('Expected Baseel scraper module at ../../scraper/baseel/script.js')
  }
}

test('Baseel treats first-party route shells with identical visible text as verified fallbacks', async () => {
  const baseel = await loadBaseelModule()

  assert.equal(
    baseel.isVerifiedRouteFallbackShell(
      BASEEL_DOT_COM_CAREERS_HTML,
      BASEEL_DOT_COM_HOMEPAGE_HTML,
      baseel.BASEEL_DOT_COM.homepageUrl,
    ),
    true,
  )

  assert.equal(
    baseel.isVerifiedRouteFallbackShell(
      `${BASEEL_DOT_COM_CAREERS_HTML}<a href="https://jobs.lever.co/baseel">Apply now</a>`,
      BASEEL_DOT_COM_HOMEPAGE_HTML,
      baseel.BASEEL_DOT_COM.homepageUrl,
    ),
    false,
  )
})

test('Baseel returns no jobs while the verified no-public-careers surfaces still hold', async () => {
  const baseel = await loadBaseelModule()
  const requestedPageUrls = []
  const requestedBundleUrls = []

  const jobs = await baseel.createBaseelScraper().run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === baseel.BASEEL_DOT_COM.homepageUrl) {
        return { status: 200, url, html: BASEEL_DOT_COM_HOMEPAGE_HTML }
      }

      if (url === baseel.BASEEL_DOT_COM.sitemapUrl) {
        return {
          status: 200,
          url,
          html: BASEEL_SITEMAP_XML(baseel.BASEEL_DOT_COM.homepageUrl),
        }
      }

      if (baseel.BASEEL_DOT_COM.routeUrls.includes(url)) {
        return { status: 200, url, html: BASEEL_DOT_COM_CAREERS_HTML }
      }

      if (url === baseel.BASEEL_DOT_IN.homepageUrl) {
        return { status: 200, url, html: BASEEL_DOT_IN_HOMEPAGE_HTML }
      }

      if (url === baseel.BASEEL_DOT_IN.sitemapUrl) {
        return {
          status: 200,
          url,
          html: BASEEL_SITEMAP_XML(baseel.BASEEL_DOT_IN.homepageUrl),
        }
      }

      if (baseel.BASEEL_DOT_IN.routeUrls.includes(url)) {
        return { status: 200, url, html: BASEEL_DOT_IN_HOMEPAGE_HTML }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedBundleUrls.push(url)
      return 'console.log("no jobs surface here")'
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedBundleUrls, [
    'https://baseel.com/_next/static/baseel-com.js',
    'https://baseel.in/_next/static/baseel-in.js',
  ])
  assert.ok(requestedPageUrls.includes(baseel.BASEEL_DOT_COM.routeUrls[0]))
  assert.ok(requestedPageUrls.includes(baseel.BASEEL_DOT_IN.routeUrls[0]))
})
