import assert from 'node:assert/strict'
import test from 'node:test'

const loadCapovexModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="theme-color" content="#2792f1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="keywords"
      content="crypto staking platform, cryptocurrency staking, staking rewards, earn passive income crypto, blockchain staking"
    >
    <meta name="author" content="Capovex">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://www.capovex.com/">
    <meta http-equiv="content-language" content="en">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <meta property="og:title" content="Secure Crypto Staking Platform">
    <meta
      property="og:description"
      content="Stake your crypto securely and earn passive income with high rewards and low fees."
    >
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.capovex.com/">
    <meta property="og:site_name" content="Crypto Staking Platform">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Secure Crypto Staking Platform">
    <meta name="twitter:description" content="Earn passive income by staking cryptocurrency securely.">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="referrer" content="no-referrer-when-downgrade">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Crypto Staking">
    <link rel="apple-touch-icon" href="/favicon.ico" />
    <title>Capovex International</title>
    <script type="module" crossorigin src="/assets/index-ra0ycuT8.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DYdVPpX3.css">
  </head>
  <body class="dark">
    <div id="root"></div>
    <script>
      window.$zoho = window.$zoho || {};
      $zoho.salesiq = $zoho.salesiq || { ready: function () {} };
    </script>
    <script
      id="zsiqscript"
      allow="microphone"
      src="https://salesiq.zohopublic.in/widget?wc=siqa107a1c8abccc0aed187cf55105e6e20a69e0c26df1fc76f92291adf74089a36"
      defer></script>
  </body>
</html>
`

const verifiedRouteFallbackHtml = officialHomepageHtml

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://capovex.com/</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://capovex.com/about</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`

const verifiedBundleText = `
O.jsx(le,{path:"/register/:refId",element:O.jsx(I1,{})}),
O.jsx(le,{path:"/about-us",element:O.jsx(OB,{})}),
O.jsx(le,{path:"/user-trust-security",element:O.jsx(DB,{})}),
O.jsx(le,{path:"/contact-us",element:O.jsx(yB,{})}),
O.jsx(le,{path:"/guide",element:O.jsx(vB,{})}),
O.jsx(le,{path:"/announcement",element:O.jsx(hB,{})}),
O.jsx(le,{path:"/apps",element:O.jsx(jB,{})}),
O.jsx(le,{path:"/help-center",element:O.jsx(J1,{})}),
O.jsx(le,{path:"/help-center/faqs",element:O.jsx(K1,{})}),
O.jsx(le,{path:"/affiliate",element:O.jsx(W1,{})})
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Capovex Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/capovex/backend-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const publicJobsBundleText = `
${verifiedBundleText}
O.jsx(le,{path:"/careers",element:O.jsx(Careers,{})}),
O.jsx(le,{path:"/jobs",element:O.jsx(Jobs,{})})
`

test('Capovex sentinel recognizes the verified homepage shell, sitemap, client bundle, and first-party route fallback shell', async () => {
  const capovex = await loadCapovexModule()
  assert.ok(capovex, 'Expected Capovex scraper module at ./script.js')

  assert.equal(capovex.SOURCE, 'capovex')
  assert.equal(capovex.COMPANY, 'Capovex')
  assert.equal(capovex.HOMEPAGE_URL, 'https://capovex.com/')
  assert.equal(capovex.SITEMAP_URL, 'https://capovex.com/sitemap.xml')
  assert.equal(capovex.BUNDLE_PATH, '/assets/index-ra0ycuT8.js')
  assert.equal(capovex.BUNDLE_URL, 'https://capovex.com/assets/index-ra0ycuT8.js')
  assert.deepEqual(capovex.EXPECTED_SITEMAP_URLS, [
    'https://capovex.com/',
    'https://capovex.com/about',
  ])
  assert.deepEqual(capovex.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://capovex.com/careers',
    'https://capovex.com/career',
    'https://capovex.com/jobs',
    'https://capovex.com/join-us',
    'https://capovex.com/joinus',
  ])
  assert.equal(capovex.extractBundleAssetPath(officialHomepageHtml), capovex.BUNDLE_PATH)
  assert.equal(capovex.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(capovex.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.deepEqual(capovex.extractSitemapUrls(sitemapXml), capovex.EXPECTED_SITEMAP_URLS)
  assert.equal(capovex.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(capovex.hasVerifiedBundleSignal(verifiedBundleText), true)
  assert.equal(capovex.hasBundleJobsSignal(verifiedBundleText), false)
  assert.equal(
    capovex.isVerifiedRouteFallbackShell(
      {
        status: 200,
        url: capovex.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
        html: verifiedRouteFallbackHtml,
      },
      officialHomepageHtml,
      capovex.BUNDLE_PATH,
    ),
    true,
  )
})

test('Capovex sentinel returns no jobs only while the verified first-party shell, sitemap, bundle, and checked routes stay stable', async () => {
  const capovex = await loadCapovexModule()
  assert.ok(capovex, 'Expected Capovex scraper module at ./script.js')

  const fetchedPages = []
  const fetchedTexts = []

  const jobs = await capovex.createCapovexScraper().run({
    fetchPage: async (url) => {
      fetchedPages.push(url)

      if (url === capovex.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === capovex.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (capovex.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedRouteFallbackHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchText: async (url) => {
      fetchedTexts.push(url)
      if (url === capovex.BUNDLE_URL) {
        return verifiedBundleText
      }

      throw new Error(`Unexpected bundle URL: ${url}`)
    },
  })

  assert.deepEqual(fetchedPages, [
    capovex.HOMEPAGE_URL,
    capovex.SITEMAP_URL,
    ...capovex.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(fetchedTexts, [capovex.BUNDLE_URL])
  assert.deepEqual(jobs, [])
})

test('Capovex sentinel fails closed when the homepage, sitemap, bundle, or checked route drifts into a jobs surface', async () => {
  const capovex = await loadCapovexModule()
  assert.ok(capovex, 'Expected Capovex scraper module at ./script.js')

  await assert.rejects(
    capovex.createCapovexScraper().run({
      fetchPage: async (url) => {
        if (url === capovex.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body><main>Unexpected</main></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    capovex.createCapovexScraper().run({
      fetchPage: async (url) => {
        if (url === capovex.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === capovex.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://capovex.com/careers</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleText,
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    capovex.createCapovexScraper().run({
      fetchPage: async (url) => {
        if (url === capovex.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === capovex.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => publicJobsBundleText,
    }),
    /client bundle/i,
  )

  await assert.rejects(
    capovex.createCapovexScraper().run({
      fetchPage: async (url) => {
        if (url === capovex.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === capovex.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === capovex.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (capovex.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: verifiedRouteFallbackHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleText,
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
