import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Forensic CyberTech – Cybersecurity &amp; Digital Forensics Company</title>
      <link rel="canonical" href="https://forensiccybertech.com/" />
    </head>
    <body>
      <header>
        <a href="/products/chitragupt">Chitragupt</a>
        <a href="/products/eagleye">EaglEye</a>
        <a href="/services">Services</a>
        <a href="/contact-us">Contact Us</a>
        <a href="/request-demo">Request Demo</a>
      </header>
      <main>
        <h1>Your Co-Pilot for a <span>Cyber-Safe</span> Ecosystem</h1>
        <section>
          <h2>About Forensic CyberTech</h2>
          <p>
            Forensic CyberTech Pvt. Ltd. is a leading cybersecurity and digital forensics company
            headquartered in Ahmedabad, India.
          </p>
          <p>Join Our Cybersecurity Newsletter for Exclusive Tips &amp; News</p>
          <p>7th Floor, Shivarth The Ace, Sindhu Bhavan Road, Ahmedabad - 380054</p>
        </section>
      </main>
      <script src="/_next/static/chunks/app/layout-abc123.js"></script>
      <script src="/_next/static/chunks/app/page-def456.js"></script>
      <script src="/_next/static/chunks/main-app-ghi789.js"></script>
      <script src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>
    </body>
  </html>
`

const verifiedRouteShellHtml = verifiedHomepageHtml.replace(
  'href="https://forensiccybertech.com/"',
  'href="https://forensiccybertech.com/careers"',
)

const verifiedSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://forensiccybertech.com</loc></url>
    <url><loc>https://forensiccybertech.com/products/chitragupt</loc></url>
    <url><loc>https://forensiccybertech.com/products/eagleye</loc></url>
    <url><loc>https://forensiccybertech.com/services/protect/cyber-risk-management</loc></url>
  </urlset>
`

const verifiedLayoutBundleJs = `
  export const navItems = ['Forensic CyberTech', 'Chitragupt', 'EaglEye', 'Request Demo']
  export const companyDomain = 'forensiccybertech.com'
`

const verifiedPageBundleJs = `
  export const homepageCopy = {
    company: 'Forensic CyberTech Pvt. Ltd.',
    hero: 'Your Co-Pilot for a Cyber-Safe Ecosystem',
    office: '7th Floor, Shivarth The Ace, Sindhu Bhavan Road, Ahmedabad - 380054',
  }
`

const genericBundleJs = 'export const runtime = true'

const bundleTextsByUrl = {
  'https://forensiccybertech.com/_next/static/chunks/app/layout-abc123.js': verifiedLayoutBundleJs,
  'https://forensiccybertech.com/_next/static/chunks/app/page-def456.js': verifiedPageBundleJs,
  'https://forensiccybertech.com/_next/static/chunks/main-app-ghi789.js': genericBundleJs,
  'https://forensiccybertech.com/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js': genericBundleJs,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/forensiccybertech/script.js')
  } catch {
    assert.fail('Expected Forensic CyberTech scraper module at ../../scraper/forensiccybertech/script.js')
  }
}

test('Forensic CyberTech validates the verified homepage, sitemap, bundles, and first-party route shell fallbacks', async () => {
  const forensic = await loadModule()

  assert.equal(forensic.SOURCE, 'forensiccybertech')
  assert.equal(forensic.COMPANY, 'Forensic CyberTech')
  assert.equal(forensic.HOMEPAGE_URL, 'https://forensiccybertech.com/')
  assert.equal(forensic.SITEMAP_URL, 'https://forensiccybertech.com/sitemap.xml')
  assert.deepEqual(forensic.CHECKED_ROUTE_URLS, [
    'https://forensiccybertech.com/careers',
    'https://forensiccybertech.com/careers/',
    'https://forensiccybertech.com/career',
    'https://forensiccybertech.com/career/',
    'https://forensiccybertech.com/jobs',
    'https://forensiccybertech.com/jobs/',
    'https://forensiccybertech.com/job',
    'https://forensiccybertech.com/job/',
    'https://forensiccybertech.com/openings',
    'https://forensiccybertech.com/openings/',
    'https://forensiccybertech.com/hiring',
    'https://forensiccybertech.com/hiring/',
  ])
  assert.equal(forensic.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(forensic.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(forensic.hasVerifiedSitemap(verifiedSitemapXml), true)
  assert.deepEqual(forensic.extractFirstPartyScriptUrls(verifiedHomepageHtml), [
    'https://forensiccybertech.com/_next/static/chunks/app/layout-abc123.js',
    'https://forensiccybertech.com/_next/static/chunks/app/page-def456.js',
    'https://forensiccybertech.com/_next/static/chunks/main-app-ghi789.js',
    'https://forensiccybertech.com/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js',
  ])
  assert.equal(forensic.hasVerifiedBundleSignal(verifiedLayoutBundleJs), true)
  assert.equal(forensic.hasVerifiedBundleSignal(verifiedPageBundleJs), true)
  assert.equal(forensic.hasBundlePublicJobsSignal(verifiedLayoutBundleJs), false)
  assert.equal(
    forensic.routeMatchesVerifiedShell(
      {
        status: 200,
        url: 'https://forensiccybertech.com/careers',
        html: verifiedRouteShellHtml,
      },
      forensic.buildRouteShellSignature(verifiedHomepageHtml),
      forensic.extractFirstPartyScriptUrls(verifiedHomepageHtml),
    ),
    true,
  )
})

test('Forensic CyberTech returns no jobs only while the verified sitemap, bundle set, and first-party routes stay on the branded shell', async () => {
  const forensic = await loadModule()
  const requestedPages = []
  const requestedBundles = []

  const jobs = await forensic.createForensicCyberTechScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === forensic.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === forensic.SITEMAP_URL) {
        return { status: 200, url, html: verifiedSitemapXml }
      }

      if (forensic.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedRouteShellHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedBundles.push(url)

      if (Object.prototype.hasOwnProperty.call(bundleTextsByUrl, url)) {
        return bundleTextsByUrl[url]
      }

      throw new Error(`Unexpected bundle URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    forensic.HOMEPAGE_URL,
    forensic.SITEMAP_URL,
    ...forensic.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(requestedBundles, forensic.extractFirstPartyScriptUrls(verifiedHomepageHtml))
  assert.deepEqual(jobs, [])
})

test('Forensic CyberTech fails closed when the homepage, sitemap, bundle contract, or checked route drifts into a public jobs surface', async () => {
  const forensic = await loadModule()

  await assert.rejects(
    forensic.createForensicCyberTechScraper().run({
      fetchPage: async (url) => {
        if (url === forensic.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    forensic.createForensicCyberTechScraper().run({
      fetchPage: async (url) => {
        if (url === forensic.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === forensic.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: verifiedSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://forensiccybertech.com/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 200, url, html: verifiedRouteShellHtml }
      },
      fetchText: async (url) => bundleTextsByUrl[url] ?? genericBundleJs,
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    forensic.createForensicCyberTechScraper().run({
      fetchPage: async (url) => {
        if (url === forensic.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === forensic.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        return { status: 200, url, html: verifiedRouteShellHtml }
      },
      fetchText: async (url) => {
        if (url === 'https://forensiccybertech.com/_next/static/chunks/app/page-def456.js') {
          return `${verifiedPageBundleJs} const careersPath = '/careers'; const board = 'https://jobs.lever.co/fct';`
        }

        return bundleTextsByUrl[url] ?? genericBundleJs
      },
    }),
    /bundle set changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    forensic.createForensicCyberTechScraper().run({
      fetchPage: async (url) => {
        if (url === forensic.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === forensic.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        if (url === forensic.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: verifiedRouteShellHtml.replace(
              '</main>',
              '<section><h2>Current Openings</h2><a href=\"https://boards.greenhouse.io/fct/security-analyst\">Apply now</a></section></main>',
            ),
          }
        }

        return { status: 200, url, html: verifiedRouteShellHtml }
      },
      fetchText: async (url) => bundleTextsByUrl[url] ?? genericBundleJs,
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
