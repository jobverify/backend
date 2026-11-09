import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>RevGain — AI Revenue Engine</title>
    <meta name="description" content="RevGain is an AI-powered revenue platform that drives retention and expansion by pairing your team with an augmented workforce of AI agents." />
    <link rel="canonical" href="https://revgain.ai/" />
    <meta property="og:site_name" content="RevGain" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "RevGain",
        "url": "https://revgain.ai/",
        "logo": "https://revgain.ai/uploads/revgain-logo.png",
        "email": "info@revgain.ai"
      }
    </script>
  </head>
  <body>
    <nav>
      <a href="/platform">Platform</a>
      <a href="/product">Product</a>
      <a href="/get-started">Get started</a>
    </nav>
    <div id="app"></div>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://revgain.ai/</loc></url>
  <url><loc>https://revgain.ai/product</loc></url>
  <url><loc>https://revgain.ai/platform</loc></url>
  <url><loc>https://revgain.ai/use-cases</loc></url>
  <url><loc>https://revgain.ai/get-started</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://revgain.ai/careers',
  html: '',
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('RevGain AI sentinel recognizes the verified homepage, sitemap, and missing careers routes', async () => {
  const revgain = await loadModule()
  assert.ok(revgain, 'Expected scraper module at ./script.js')

  assert.equal(revgain.SOURCE, 'revgainai')
  assert.equal(revgain.COMPANY, 'RevGain AI')
  assert.equal(revgain.HOMEPAGE_URL, 'https://revgain.ai/')
  assert.equal(revgain.SITEMAP_URL, 'https://revgain.ai/sitemap.xml')
  assert.deepEqual(revgain.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://revgain.ai/careers',
    'https://revgain.ai/careers/',
    'https://revgain.ai/career',
    'https://revgain.ai/career/',
    'https://revgain.ai/jobs',
    'https://revgain.ai/jobs/',
    'https://revgain.ai/join-us',
    'https://revgain.ai/join-us/',
    'https://revgain.ai/openings',
    'https://revgain.ai/openings/',
    'https://revgain.ai/work-with-us',
    'https://revgain.ai/work-with-us/',
  ])

  assert.equal(revgain.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(revgain.hasUnexpectedCareerLikeLink(homepageHtml), false)
  assert.equal(revgain.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(revgain.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(revgain.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('RevGain AI sentinel returns no jobs only while the verified first-party surface exposes no public careers board', async () => {
  const revgain = await loadModule()
  assert.ok(revgain, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await revgain.createRevgainAiScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === revgain.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === revgain.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (revgain.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { ...missingCareerRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    revgain.HOMEPAGE_URL,
    revgain.SITEMAP_URL,
    ...revgain.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('RevGain AI sentinel fails closed when the verified public surface drifts', async () => {
  const revgain = await loadModule()
  assert.ok(revgain, 'Expected scraper module at ./script.js')

  await assert.rejects(
    revgain.createRevgainAiScraper().run({
      fetchPage: async (url) => {
        if (url === revgain.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    revgain.createRevgainAiScraper().run({
      fetchPage: async (url) => {
        if (url === revgain.HOMEPAGE_URL) {
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
    revgain.createRevgainAiScraper().run({
      fetchPage: async (url) => {
        if (url === revgain.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === revgain.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://revgain.ai/careers</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    revgain.createRevgainAiScraper().run({
      fetchPage: async (url) => {
        if (url === revgain.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === revgain.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === revgain.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current Openings</p></body></html>',
          }
        }

        if (revgain.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { ...missingCareerRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party careers route changed or now exposes a public careers surface/i,
  )
})
