import assert from 'node:assert/strict'
import test from 'node:test'

const loadNslhubBraneModule = async () => {
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
    <meta charset="utf-8">
    <title>Brane</title>
    <base href="/">
    <meta name="viewport" content="width=device-width, initial-scale=1,maximum-scale=1, user-scalable=no">
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <script src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/35984/ScrollLottie.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Swiper/4.5.1/js/swiper.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/Swiper/4.5.1/css/swiper.min.css" rel="stylesheet">
    <script>
      (function (w, d, s, l, i) {
        w[l] = w[l] || [];
        w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      })(window, document, "script", "dataLayer", "GTM-WTBXDDGV");
    </script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-J71TD8BCKT"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("config", "G-J71TD8BCKT");
    </script>
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.d06baef5c86fa129.js" type="module"></script>
    <script src="polyfills.9796ab178db5e42b.js" type="module"></script>
    <script src="scripts.f543dbdb9f3bd927.js" defer></script>
    <script src="main.47787a80a31a310d.js" type="module"></script>
  </body>
</html>
`

const verifiedRouteFallbackHtml = officialHomepageHtml

const verifiedBundleText = `
self.webpackChunkbrane_ui=self.webpackChunkbrane_ui||[];
const aboutCopy="Brane Technologies, products and services based on its revolutionary solution platform - NSL Hub (Natural Solutions Language).";
const contactApi="https://vss.carnivalsb.nslhub.com/dsd-orch/adapter/execute/Contact Us_RI";
const loginApi="https://vss.carnivalsb.nslhub.com/dsd-orch/nsl-iam/api/login/v2/login-action";
const videoAsset="https://nslhub-beta-s3.s3.ap-south-1.amazonaws.com/new_ui_videos/thomas.mp4";
`

const verifiedLegacyLanderHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
    <link rel="icon" href="data:,"/>
    <script>window.LANDER_SYSTEM="PW"</script>
    <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
    <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
    <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.98fc5cd3.js"></script>
    <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Brane Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers at Brane</h1>
      <p>We are hiring.</p>
      <a href="https://jobs.lever.co/brane/backend-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const publicJobsBundleText = `
${verifiedBundleText}
path:"/careers"
path:"/jobs"
https://jobs.lever.co/brane/backend-engineer
`

test('NSLHUB (Brane) sentinel recognizes the verified Brane shell, NSL Hub bundle identity, legacy lander, and route fallback shell', async () => {
  const nslhubBrane = await loadNslhubBraneModule()
  assert.ok(nslhubBrane, 'Expected NSLHUB (Brane) scraper module at ./script.js')

  assert.equal(nslhubBrane.SOURCE, 'nslhubbrane')
  assert.equal(nslhubBrane.COMPANY, 'NSLHUB (Brane)')
  assert.equal(nslhubBrane.HOMEPAGE_URL, 'https://braneenterprises.com/')
  assert.equal(nslhubBrane.LEGACY_NSLHUB_LANDER_URL, 'https://nslhub.in/lander')
  assert.deepEqual(nslhubBrane.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://braneenterprises.com/careers',
    'https://braneenterprises.com/careers/',
    'https://braneenterprises.com/career',
    'https://braneenterprises.com/career/',
    'https://braneenterprises.com/jobs',
    'https://braneenterprises.com/jobs/',
    'https://braneenterprises.com/join-us',
    'https://braneenterprises.com/join-us/',
    'https://braneenterprises.com/openings',
    'https://braneenterprises.com/openings/',
  ])
  assert.equal(
    nslhubBrane.extractMainBundleAssetPath(officialHomepageHtml),
    'main.47787a80a31a310d.js',
  )
  assert.equal(nslhubBrane.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(nslhubBrane.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(nslhubBrane.hasVerifiedBundleIdentity(verifiedBundleText), true)
  assert.equal(nslhubBrane.hasBundleJobsSignal(verifiedBundleText), false)
  assert.equal(nslhubBrane.hasLegacyNslhubLanderSignal(verifiedLegacyLanderHtml), true)
  assert.equal(
    nslhubBrane.isVerifiedRouteFallbackShell(
      {
        status: 200,
        url: nslhubBrane.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
        html: verifiedRouteFallbackHtml,
      },
      officialHomepageHtml,
      'main.47787a80a31a310d.js',
    ),
    true,
  )
})

test('NSLHUB (Brane) sentinel returns no jobs only while the Brane shell, NSL Hub bundle, legacy lander, and checked routes stay stable', async () => {
  const nslhubBrane = await loadNslhubBraneModule()
  assert.ok(nslhubBrane, 'Expected NSLHUB (Brane) scraper module at ./script.js')

  const fetchedPages = []
  const fetchedTexts = []

  const jobs = await nslhubBrane.createNslhubBraneScraper().run({
    fetchPage: async (url) => {
      fetchedPages.push(url)

      if (url === nslhubBrane.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === nslhubBrane.LEGACY_NSLHUB_LANDER_URL) {
        return { status: 200, url, html: verifiedLegacyLanderHtml }
      }

      if (nslhubBrane.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedRouteFallbackHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchText: async (url) => {
      fetchedTexts.push(url)

      if (url === 'https://braneenterprises.com/main.47787a80a31a310d.js') {
        return verifiedBundleText
      }

      throw new Error(`Unexpected bundle URL: ${url}`)
    },
  })

  assert.deepEqual(fetchedPages, [
    nslhubBrane.HOMEPAGE_URL,
    nslhubBrane.LEGACY_NSLHUB_LANDER_URL,
    ...nslhubBrane.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(fetchedTexts, ['https://braneenterprises.com/main.47787a80a31a310d.js'])
  assert.deepEqual(jobs, [])
})

test('NSLHUB (Brane) sentinel fails closed when the homepage, bundle, legacy lander, or checked routes drift into a jobs surface', async () => {
  const nslhubBrane = await loadNslhubBraneModule()
  assert.ok(nslhubBrane, 'Expected NSLHUB (Brane) scraper module at ./script.js')

  await assert.rejects(
    nslhubBrane.createNslhubBraneScraper().run({
      fetchPage: async (url) => {
        if (url === nslhubBrane.HOMEPAGE_URL) {
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
    nslhubBrane.createNslhubBraneScraper().run({
      fetchPage: async (url) => {
        if (url === nslhubBrane.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === nslhubBrane.LEGACY_NSLHUB_LANDER_URL) {
          return { status: 200, url, html: verifiedLegacyLanderHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => publicJobsBundleText,
    }),
    /client bundle/i,
  )

  await assert.rejects(
    nslhubBrane.createNslhubBraneScraper().run({
      fetchPage: async (url) => {
        if (url === nslhubBrane.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === nslhubBrane.LEGACY_NSLHUB_LANDER_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleText,
    }),
    /nsl hub legacy lander|legacy lander/i,
  )

  await assert.rejects(
    nslhubBrane.createNslhubBraneScraper().run({
      fetchPage: async (url) => {
        if (url === nslhubBrane.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === nslhubBrane.LEGACY_NSLHUB_LANDER_URL) {
          return { status: 200, url, html: verifiedLegacyLanderHtml }
        }

        if (url === nslhubBrane.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (nslhubBrane.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: verifiedRouteFallbackHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => verifiedBundleText,
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
