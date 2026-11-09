import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FlintLab Sirius - Device Infrastructure PaaS</title>
    <meta name="description" content="FlintLab is an AI-powered device infrastructure company. The Sirius Platform is an AI-powered device infrastructure PaaS, unifying real and virtual devices with cloud-native execution, predictive observability, and seamless integration via UI, CLI, and APIs - enabling enterprises to orchestrate and manage devices at scale with low latency and minimal operational overhead." />
    <link rel="canonical" href="https://flintlab.io" />
    <meta property="og:title" content="FlintLab Sirius - AI-Powered Device Infrastructure PaaS" />
  </head>
  <body>
    <a href="#main-content">Skip to main content</a>
    <header>
      <a href="/">FLINTLAB</a>
      <nav>
        <a href="/platform">Platform</a>
        <a href="/blog">Blog</a>
        <a href="/resources">Resources</a>
        <a href="/pricing">Pricing</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main id="main-content">
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "FlintLab",
          "legalName": "AI NEXUS FLINT LAB INDIA PRIVATE LIMITED.",
          "contactPoint": {
            "@type": "ContactPoint",
            "email": "engage@flintlab.io"
          }
        }
      </script>
      <h1>Ship Mobile &amp; Web Apps</h1>
      <h2>With Real Confidence, At Scale</h2>
      <p>FlintLab unifies real devices, emulators, and cloud-native execution in one platform, backed by a developer advocacy team that stress-tests your releases before your users do.</p>
      <p>Platform, People, and Compliance: All Covered</p>
      <h3>Sirius: One Platform for Every Device</h3>
      <p>FlintLab's AI-powered device infrastructure PaaS unifies real and virtual devices with cloud-native execution, one-click runs, and predictive observability, all reachable through UI, CLI, and APIs.</p>
      <button>Ask FlintBot</button>
      <a href="https://www.linkedin.com/company/flintlab-inc">LinkedIn</a>
    </main>
  </body>
</html>
`

const officialSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://flintlab.io/</loc></url>
  <url><loc>https://flintlab.io/platform</loc></url>
  <url><loc>https://flintlab.io/pricing</loc></url>
  <url><loc>https://flintlab.io/about</loc></url>
  <url><loc>https://flintlab.io/resources</loc></url>
  <url><loc>https://flintlab.io/launchpad</loc></url>
  <url><loc>https://flintlab.io/security</loc></url>
  <url><loc>https://flintlab.io/contact</loc></url>
  <url><loc>https://flintlab.io/krishna-seerapu</loc></url>
  <url><loc>https://flintlab.io/docs</loc></url>
  <url><loc>https://flintlab.io/flintapi-docs</loc></url>
  <url><loc>https://flintlab.io/flintcli-docs</loc></url>
  <url><loc>https://flintlab.io/flintui-docs</loc></url>
  <url><loc>https://flintlab.io/privacy-policy</loc></url>
  <url><loc>https://flintlab.io/blog</loc></url>
</urlset>
`

const loadFlintLabModule = async () => {
  try {
    return await import('../../scraper/flintlab/script.js')
  } catch {
    assert.fail('Expected FlintLab scraper module at ../../scraper/flintlab/script.js')
  }
}

test('FlintLab scraper constants stay pinned to the verified official homepage, sitemap, and no-public-careers routes', async () => {
  const flintLab = await loadFlintLabModule()

  assert.equal(flintLab.SOURCE, 'flintlab')
  assert.equal(flintLab.COMPANY, 'FlintLab')
  assert.equal(flintLab.HOMEPAGE_URL, 'https://flintlab.io/')
  assert.equal(flintLab.SITEMAP_URL, 'https://flintlab.io/sitemap.xml')
  assert.equal(flintLab.VERIFIED_ON, '2026-08-07')
  assert.match(flintLab.VERIFIED_SURFACE_SUMMARY, /Friday, August 7, 2026/i)
  assert.match(flintLab.VERIFIED_SURFACE_SUMMARY, /Ship Mobile & Web Apps/i)
  assert.match(flintLab.VERIFIED_SURFACE_SUMMARY, /Ask FlintBot/i)
  assert.deepEqual(flintLab.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://flintlab.io/careers',
    'https://flintlab.io/careers/',
    'https://flintlab.io/career',
    'https://flintlab.io/career/',
    'https://flintlab.io/jobs',
    'https://flintlab.io/jobs/',
  ])
  assert.equal(flintLab.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(flintLab.sitemapHasCareerLikeUrl(officialSitemapXml), false)
  assert.equal(flintLab.isMissingCareerRoute({ status: 404 }), true)
})

test('FlintLab returns no jobs only while the verified first-party homepage and sitemap expose no careers surface', async () => {
  const flintLab = await loadFlintLabModule()
  const requestedUrls = []

  const jobs = await flintLab.createFlintLabScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === flintLab.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === flintLab.SITEMAP_URL) {
        return { status: 200, url, html: officialSitemapXml }
      }

      if (flintLab.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    flintLab.HOMEPAGE_URL,
    flintLab.SITEMAP_URL,
    ...flintLab.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('FlintLab fails closed when the homepage, sitemap, or a checked careers route changes materially', async () => {
  const flintLab = await loadFlintLabModule()

  await assert.rejects(
    flintLab.createFlintLabScraper().run({
      fetchPage: async (url) => {
        if (url === flintLab.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === flintLab.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    flintLab.createFlintLabScraper().run({
      fetchPage: async (url) => {
        if (url === flintLab.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === flintLab.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: officialSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://flintlab.io/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    flintLab.createFlintLabScraper().run({
      fetchPage: async (url) => {
        if (url === flintLab.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === flintLab.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        if (url === flintLab.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open positions</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route/i,
  )
})
