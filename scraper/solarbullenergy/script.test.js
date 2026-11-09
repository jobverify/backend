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
  <!doctype html>
  <html lang="en">
    <head>
      <title>Solar Bull Energy LLP</title>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <script defer="defer" src="/static/js/main.0c0e4f43.js"></script>
    </head>
    <body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>
    </body>
  </html>
`

const assetManifestJson = JSON.stringify({
  files: {
    'main.js': '/static/js/main.0c0e4f43.js',
    'main.css': '/static/css/main.11111111.css',
  },
  entrypoints: [
    'static/css/main.11111111.css',
    'static/js/main.0c0e4f43.js',
  ],
}, null, 2)

const bundleText = `
  (() => {
    const brandA = "Solar Bull Energy LLP";
    const brandB = "SolarBull Energy LLP";
    const nav = ["Home", "About", "Contact"];
    console.log(brandA, brandB, nav);
  })();
`

test('Solar Bull Energy validates the official app shell, asset manifest, bundle, and route fallbacks', async () => {
  const solarBullEnergy = await loadModule()
  assert.ok(solarBullEnergy, 'Solar Bull Energy scraper module should load')

  assert.equal(solarBullEnergy.SOURCE, 'solarbullenergy')
  assert.equal(solarBullEnergy.COMPANY, 'Solar Bull Energy')
  assert.equal(solarBullEnergy.HOMEPAGE_URL, 'https://www.solarbull.in/')
  assert.equal(solarBullEnergy.ASSET_MANIFEST_URL, 'https://www.solarbull.in/asset-manifest.json')
  assert.deepEqual(solarBullEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.solarbull.in/careers',
    'https://www.solarbull.in/career',
    'https://www.solarbull.in/jobs',
    'https://www.solarbull.in/join-us',
  ])
  assert.equal(solarBullEnergy.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(solarBullEnergy.extractMainBundleAssetPath(homepageHtml), '/static/js/main.0c0e4f43.js')
  assert.equal(
    solarBullEnergy.extractMainBundlePathFromAssetManifest(assetManifestJson),
    '/static/js/main.0c0e4f43.js',
  )
  assert.equal(solarBullEnergy.hasVerifiedBundleIdentity(bundleText), true)
  assert.equal(solarBullEnergy.hasBundleJobsSignal(bundleText), false)
  assert.equal(
    solarBullEnergy.isVerifiedRouteFallbackShell({
      status: 200,
      url: solarBullEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: homepageHtml,
    }, homepageHtml, '/static/js/main.0c0e4f43.js'),
    true,
  )
})

test('Solar Bull Energy returns no jobs only while the verified shell and bundle contract remains intact', async () => {
  const solarBullEnergy = await loadModule()
  assert.ok(solarBullEnergy, 'Solar Bull Energy scraper module should load')

  const requestedUrls = []
  const jobs = await solarBullEnergy.createSolarBullEnergyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === solarBullEnergy.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === solarBullEnergy.ASSET_MANIFEST_URL) return { status: 200, url, html: assetManifestJson }
      if (url === 'https://www.solarbull.in/static/js/main.0c0e4f43.js') {
        return { status: 200, url, html: bundleText }
      }
      if (solarBullEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageHtml }
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    solarBullEnergy.HOMEPAGE_URL,
    solarBullEnergy.ASSET_MANIFEST_URL,
    'https://www.solarbull.in/static/js/main.0c0e4f43.js',
    ...solarBullEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Solar Bull Energy fails closed when the shell, manifest, bundle, or careers-route contract changes', async () => {
  const solarBullEnergy = await loadModule()
  assert.ok(solarBullEnergy, 'Solar Bull Energy scraper module should load')

  await assert.rejects(
    solarBullEnergy.createSolarBullEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === solarBullEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }
        if (url === solarBullEnergy.ASSET_MANIFEST_URL) {
          return { status: 200, url, html: assetManifestJson }
        }
        return { status: 200, url, html: bundleText }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    solarBullEnergy.createSolarBullEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === solarBullEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === solarBullEnergy.ASSET_MANIFEST_URL) {
          return {
            status: 200,
            url,
            html: JSON.stringify({ files: { 'main.js': '/static/js/main.changed.js' } }),
          }
        }
        return { status: 200, url, html: bundleText }
      },
    }),
    /asset manifest/i,
  )

  await assert.rejects(
    solarBullEnergy.createSolarBullEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === solarBullEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === solarBullEnergy.ASSET_MANIFEST_URL) {
          return { status: 200, url, html: assetManifestJson }
        }
        if (url === 'https://www.solarbull.in/static/js/main.0c0e4f43.js') {
          return {
            status: 200,
            url,
            html: 'Solar Bull Energy LLP jobs.lever.co/solarbull Apply now',
          }
        }
        return { status: 200, url, html: homepageHtml }
      },
    }),
    /client bundle changed materially or now exposes a public jobs surface/i,
  )

  await assert.rejects(
    solarBullEnergy.createSolarBullEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === solarBullEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === solarBullEnergy.ASSET_MANIFEST_URL) {
          return { status: 200, url, html: assetManifestJson }
        }
        if (url === 'https://www.solarbull.in/static/js/main.0c0e4f43.js') {
          return { status: 200, url, html: bundleText }
        }
        return {
          status: 200,
          url,
          html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
        }
      },
    }),
    /checked first-party routes changed materially or now expose public jobs/i,
  )
})
