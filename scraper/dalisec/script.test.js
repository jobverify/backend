import assert from 'node:assert/strict'
import test from 'node:test'

const loadDalisecModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Dalisec scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="generator" content="Gatsby 5.15.0" />
    <style data-href="/styles.2a94ab3181aa24f9e88c.css" data-identity="gatsby-global-css">
      @import url(https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap);
      @import url(https://fonts.googleapis.com/css2?family=Montserrat:wght@300..700&display=swap);
      @import url(https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,400;0,700&display=swap);
      .dark { --error-404-bg: #0e1016; }
    </style>
  </head>
  <body>
    <div id="___gatsby">
      <div id="gatsby-focus-wrapper"></div>
    </div>
    <script src="/webpack-runtime-e601260fd7ae77e49c7d.js"></script>
    <script src="/framework-f18f70ac5b211a5cf213.js"></script>
    <script src="/app-697d9dc5bbba5b32d90a.js"></script>
    <script src="https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496"></script>
  </body>
</html>
`

const missingCareersRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="generator" content="Gatsby 5.15.0" />
    <style data-href="/styles.2a94ab3181aa24f9e88c.css" data-identity="gatsby-global-css">
      @import url(https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap);
      @import url(https://fonts.googleapis.com/css2?family=Montserrat:wght@300..700&display=swap);
      @import url(https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,400;0,700&display=swap);
      .dark { --error-404-bg: #0e1016; --error-404-h1: #fff; }
    </style>
  </head>
  <body>
    <div id="___gatsby">
      <div id="gatsby-focus-wrapper"></div>
    </div>
    <script src="/webpack-runtime-e601260fd7ae77e49c7d.js"></script>
    <script src="/framework-f18f70ac5b211a5cf213.js"></script>
    <script src="/app-697d9dc5bbba5b32d90a.js"></script>
    <script src="https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496"></script>
  </body>
</html>
`

const placeholderSitemapXml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://www.yourdomain.tld/sitemap-0.xml</loc></sitemap></sitemapindex>`

const verifiedBundleJs = `
"component---src-pages-404-tsx";
"component---src-pages-about-us-tsx";
"component---src-pages-application-security-tsx";
"component---src-pages-blockchain-security-tsx";
"component---src-pages-cloud-security-tsx";
"component---src-pages-contact-tsx";
"component---src-pages-cyber-risk-management-tsx";
"component---src-pages-data-privacy-tsx";
"component---src-pages-details-tsx";
"component---src-pages-enterprise-security-tsx";
"component---src-pages-index-tsx";
"component---src-pages-industrial-security-tsx";
"component---src-pages-managed-services-tsx";
"component---src-pages-managed-vapt-tsx";
"component---src-pages-network-security-tsx";
"component---src-pages-threat-simulations-tsx";
"component---src-pages-why-us-tsx";
`

const publicJobsBundleJs = `${verifiedBundleJs}\ncomponent---src-pages-careers-tsx\nCurrent Openings\njobs.lever.co/dalisec`
const cloudflare526Text = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>dalisec.com | 526: Invalid SSL certificate</title>
  </head>
  <body>
    <main>
      <h1>Invalid SSL certificate</h1>
      <p>Error code 526</p>
    </main>
  </body>
</html>
`

test('Dalisec sentinel recognizes the historical Gatsby shell helpers and the current untrustworthy Cloudflare 526 edge page', async () => {
  const dalisec = await loadDalisecModule()

  assert.equal(dalisec.SOURCE, 'dalisec')
  assert.equal(dalisec.COMPANY, 'Dalisec')
  assert.equal(dalisec.HOMEPAGE_URL, 'https://dalisec.com/')
  assert.equal(dalisec.SITEMAP_URL, 'https://dalisec.com/sitemap-index.xml')
  assert.equal(dalisec.UNTRUSTWORTHY_EDGE_ERROR_STATUS_CODE, 526)
  assert.deepEqual(dalisec.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://dalisec.com/careers',
    'https://dalisec.com/career',
    'https://dalisec.com/jobs',
    'https://dalisec.com/join-us',
    'https://dalisec.com/openings',
    'https://dalisec.com/current-openings',
    'https://dalisec.com/work-with-us',
  ])

  assert.equal(dalisec.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(dalisec.hasPublicJobsSignal(homepageHtml), false)
  assert.deepEqual(dalisec.extractFirstPartyScriptPaths(homepageHtml), [
    '/webpack-runtime-e601260fd7ae77e49c7d.js',
    '/framework-f18f70ac5b211a5cf213.js',
    '/app-697d9dc5bbba5b32d90a.js',
  ])
  assert.equal(dalisec.extractAppBundlePath(homepageHtml), '/app-697d9dc5bbba5b32d90a.js')
  assert.equal(dalisec.isVerifiedPlaceholderSitemap(placeholderSitemapXml), true)
  assert.equal(dalisec.hasVerifiedBundleSignal(verifiedBundleJs), true)
  assert.equal(dalisec.hasBundleJobsSignal(verifiedBundleJs), false)
  assert.equal(
    dalisec.isVerifiedCloudflareEdgeErrorPage({
      status: 526,
      url: dalisec.HOMEPAGE_URL,
      html: cloudflare526Text,
    }),
    true,
  )
  assert.equal(
    dalisec.isVerifiedMissingCareersRoute(
      { status: 404, url: 'https://dalisec.com/careers', html: missingCareersRouteHtml },
      dalisec.extractFirstPartyScriptPaths(homepageHtml),
    ),
    true,
  )
})

test('Dalisec sentinel returns no jobs while the verified first-party no-public-careers surface stays intact', async () => {
  const dalisec = await loadDalisecModule()
  const requestedPages = []
  const requestedTexts = []

  const jobs = await dalisec.createDalisecScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === dalisec.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === dalisec.SITEMAP_URL) {
        return { status: 200, url, html: placeholderSitemapXml }
      }

      if (dalisec.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingCareersRouteHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === 'https://dalisec.com/app-697d9dc5bbba5b32d90a.js') {
        return verifiedBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    dalisec.HOMEPAGE_URL,
    dalisec.SITEMAP_URL,
    ...dalisec.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(requestedTexts, ['https://dalisec.com/app-697d9dc5bbba5b32d90a.js'])
  assert.deepEqual(jobs, [])
})

test('Dalisec sentinel returns [] when the current public surface is the verified untrustworthy Cloudflare 526 edge error', async () => {
  const dalisec = await loadDalisecModule()
  const requestedPages = []

  const jobs = await dalisec.createDalisecScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      return { status: 526, url, html: cloudflare526Text }
    },
    fetchText: async () => {
      assert.fail('Did not expect the app bundle to be fetched after a Cloudflare 526 edge error')
    },
  })

  assert.deepEqual(requestedPages, [dalisec.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Dalisec sentinel fails closed when the historical homepage, sitemap, bundle, or checked route drifts', async () => {
  const dalisec = await loadDalisecModule()

  await assert.rejects(
    dalisec.createDalisecScraper().run({
      fetchPage: async (url) => {
        if (url === dalisec.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><main>Unexpected shell</main></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleJs,
    }),
    /official homepage/i,
  )

  await assert.rejects(
    dalisec.createDalisecScraper().run({
      fetchPage: async (url) => {
        if (url === dalisec.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dalisec.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://dalisec.com/careers</loc></sitemap></sitemapindex>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleJs,
    }),
    /placeholder sitemap/i,
  )

  await assert.rejects(
    dalisec.createDalisecScraper().run({
      fetchPage: async (url) => {
        if (url === dalisec.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dalisec.SITEMAP_URL) {
          return { status: 200, url, html: placeholderSitemapXml }
        }

        if (dalisec.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingCareersRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => publicJobsBundleJs,
    }),
    /app bundle/i,
  )

  await assert.rejects(
    dalisec.createDalisecScraper().run({
      fetchPage: async (url) => {
        if (url === dalisec.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dalisec.SITEMAP_URL) {
          return { status: 200, url, html: placeholderSitemapXml }
        }

        if (url === dalisec.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><main><h1>Current Openings</h1><a href="https://jobs.lever.co/dalisec/security-engineer">Apply now</a></main></body></html>',
          }
        }

        if (dalisec.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingCareersRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleJs,
    }),
    /careers route changed materially|public careers surface/i,
  )
})
