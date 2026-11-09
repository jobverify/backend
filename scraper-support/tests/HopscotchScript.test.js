import assert from 'node:assert/strict'
import test from 'node:test'

const loadHopscotchModule = async () => {
  try {
    return await import('../../scraper/hopscotch/script.js')
  } catch {
    assert.fail('Expected Hopscotch scraper module at ../../scraper/hopscotch/script.js')
  }
}

const officialShellHtml = `
<!doctype html>
<html ng-app="ngHopscotch" ng-strict-di ng-controller="AppController as appCtrl" lang="en">
  <head>
    <base href="/"/>
    <meta charset="utf-8">
    <link rel="preconnect" href="https://static.hopscotch.in">
    <meta property="og:site_name" content="Hopscotch.India" />
    <meta name="twitter:site" content="@Hopscotchindia">
    <meta name="twitter:app:id:googleplay" content="in.hopscotch.android">
    <script>
      window.analytics = window.analytics || []
    </script>
    <link href="https://static.hopscotch.in/web2/main.52e9de651cf55b67d455.css" rel="stylesheet">
  </head>
  <body>
    <header>
      <a class="logo" href="/?funnel=New&amp;from_screen=home">Hopscotch</a>
      <a href="/help">Help</a>
    </header>
    <noscript>
      <div class="message-container">
        <strong>Javascript required</strong>
        <p>We’re sorry, but Hopscotch website doesn’t work properly without JavaScript enabled.</p>
      </div>
    </noscript>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.hopscotch.in/</loc></url>
  <url><loc>https://www.hopscotch.in/help</loc></url>
  <url><loc>https://www.hopscotch.in/about/AboutUs</loc></url>
  <url><loc>https://www.hopscotch.in/about/Terms</loc></url>
  <url><loc>https://www.hopscotch.in/about/privacy</loc></url>
</urlset>
`

const driftedSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.hopscotch.in/</loc></url>
  <url><loc>https://www.hopscotch.in/careers</loc></url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html ng-app="ngHopscotch" lang="en">
  <head>
    <link rel="preconnect" href="https://static.hopscotch.in">
    <meta property="og:site_name" content="Hopscotch.India" />
    <meta name="twitter:site" content="@Hopscotchindia">
    <meta name="twitter:app:id:googleplay" content="in.hopscotch.android">
  </head>
  <body>
    <section>
      <h1>Current Openings</h1>
      <article>
        <h2>Fashion Buyer</h2>
        <a href="https://www.hopscotch.in/careers/fashion-buyer">Apply now</a>
      </article>
    </section>
  </body>
</html>
`

test('Hopscotch sentinel pins the verified first-party app shell, sitemap, and common job-like routes', async () => {
  const hopscotch = await loadHopscotchModule()

  assert.equal(hopscotch.SOURCE, 'hopscotch')
  assert.equal(hopscotch.COMPANY, 'Hopscotch')
  assert.equal(hopscotch.VERIFIED_ON, '2026-07-16')
  assert.equal(hopscotch.HOMEPAGE_URL, 'https://www.hopscotch.in/')
  assert.equal(hopscotch.SITEMAP_URL, 'https://www.hopscotch.in/sitemap.xml')
  assert.deepEqual(hopscotch.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.hopscotch.in/careers',
    'https://www.hopscotch.in/jobs',
    'https://www.hopscotch.in/job-openings',
  ])

  assert.equal(hopscotch.hasOfficialShellSignal(officialShellHtml), true)
  assert.equal(hopscotch.hasPublicJobBoardSignal(officialShellHtml), false)
  assert.equal(hopscotch.hasPublicJobBoardSignal(publicJobsHtml), true)
  assert.equal(hopscotch.hasExpectedSitemap(sitemapXml), true)
  assert.equal(hopscotch.hasExpectedSitemap(driftedSitemapXml), false)
  assert.equal(
    hopscotch.isVerifiedNoPublicJobRoute({ status: 200, url: hopscotch.NO_PUBLIC_JOB_ROUTE_URLS[0], html: officialShellHtml }),
    true,
  )
  assert.equal(
    hopscotch.isVerifiedNoPublicJobRoute({ status: 200, url: hopscotch.NO_PUBLIC_JOB_ROUTE_URLS[0], html: publicJobsHtml }),
    false,
  )
})

test('Hopscotch sentinel returns [] only while the verified no-public-jobs shell remains unchanged', async () => {
  const hopscotch = await loadHopscotchModule()
  const requestedUrls = []

  const jobs = await hopscotch.createHopscotchScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === hopscotch.HOMEPAGE_URL) {
        return { status: 200, url, html: officialShellHtml }
      }

      if (url === hopscotch.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (hopscotch.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: officialShellHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hopscotch.HOMEPAGE_URL,
    hopscotch.SITEMAP_URL,
    ...hopscotch.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Hopscotch sentinel fails closed when the shell, sitemap, or common job-like routes drift into a public jobs surface', async () => {
  const hopscotch = await loadHopscotchModule()

  await assert.rejects(
    hopscotch.createHopscotchScraper().run({
      fetchPage: async (url) => {
        if (url === hopscotch.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official shell/i,
  )

  await assert.rejects(
    hopscotch.createHopscotchScraper().run({
      fetchPage: async (url) => {
        if (url === hopscotch.HOMEPAGE_URL) {
          return { status: 200, url, html: officialShellHtml }
        }

        if (url === hopscotch.SITEMAP_URL) {
          return { status: 200, url, html: driftedSitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    hopscotch.createHopscotchScraper().run({
      fetchPage: async (url) => {
        if (url === hopscotch.HOMEPAGE_URL) {
          return { status: 200, url, html: officialShellHtml }
        }

        if (url === hopscotch.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === hopscotch.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (hopscotch.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: officialShellHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /common job route changed materially or now exposes public jobs/i,
  )
})
