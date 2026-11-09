import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASSET_MANIFEST_URL,
  BARE_COMPANY_URL,
  CAREERS_ROUTE_URL,
  MAIN_JS_PATH,
  WWW_COMPANY_URL,
  createRovoAutomationScraper,
  hasExpectedAssetManifest,
  hasOfficialHomepageSignal,
  isSpaShellWithoutHiringSurface,
  lacksHiringSignals,
} from './script.js'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="description" content="RovoAutomation - IoT and Automation Solutions Provider"/>
    <title>RovoAutomation - IoT & Automation Solutions</title>
    <script defer="defer" src="/static/js/main.73712e12.js"></script>
    <link href="/static/css/main.74831a95.css" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const verifiedAssetManifest = JSON.stringify({
  files: {
    'main.css': '/static/css/main.74831a95.css',
    'main.js': '/static/js/main.73712e12.js',
    index: '/index.html',
  },
  entrypoints: [
    'static/css/main.74831a95.css',
    'static/js/main.73712e12.js',
  ],
})

const verifiedBundle = `
to:"/about"
to:"/product"
to:"/solutions"
to:"/contact"
path:"/rovoconnect"
path:"/rovovision"
path:"/user"
path:"/andon"
path:"/OEE"
path:"/visitech"
path:"/rovopepole"
`

test('exports the verified official Rovo Automation URLs and asset path', () => {
  assert.equal(BARE_COMPANY_URL, 'https://rovoautomation.com/')
  assert.equal(WWW_COMPANY_URL, 'https://www.rovoautomation.com/')
  assert.equal(CAREERS_ROUTE_URL, 'https://rovoautomation.com/careers')
  assert.equal(ASSET_MANIFEST_URL, 'https://rovoautomation.com/asset-manifest.json')
  assert.equal(MAIN_JS_PATH, '/static/js/main.73712e12.js')
})

test('helpers recognize the verified official SPA shell and non-hiring bundle', () => {
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(isSpaShellWithoutHiringSurface(officialHomepageHtml), true)
  assert.equal(hasExpectedAssetManifest(JSON.parse(verifiedAssetManifest)), true)
  assert.equal(lacksHiringSignals(verifiedBundle), true)

  assert.equal(hasOfficialHomepageSignal('<html><title>Placeholder</title></html>'), false)
  assert.equal(isSpaShellWithoutHiringSurface('<html><body>No root node</body></html>'), false)
  assert.equal(hasExpectedAssetManifest({ files: { 'main.js': '/static/js/other.js' } }), false)
  assert.equal(lacksHiringSignals('Join our careers team today'), false)
})

test('run returns no jobs only while the verified first-party non-listing surface is unchanged', async () => {
  const requestedUrls = []
  const jobs = await createRovoAutomationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === BARE_COMPANY_URL) return officialHomepageHtml
      if (url === CAREERS_ROUTE_URL) return officialHomepageHtml
      if (url === `https://rovoautomation.com${MAIN_JS_PATH}`) return verifiedBundle

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === ASSET_MANIFEST_URL) return JSON.parse(verifiedAssetManifest)

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    BARE_COMPANY_URL,
    CAREERS_ROUTE_URL,
    ASSET_MANIFEST_URL,
    `https://rovoautomation.com${MAIN_JS_PATH}`,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the homepage no longer matches the verified official site shell', async () => {
  await assert.rejects(
    createRovoAutomationScraper().run({
      fetchText: async (url) => {
        if (url === BARE_COMPANY_URL) {
          return '<html><head><title>Coming Soon</title></head><body>Placeholder</body></html>'
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => {
        throw new Error('fetchJson should not be called when homepage validation fails')
      },
    }),
    /Rovo Automation homepage no longer matches the verified official first-party site/i,
  )
})

test('run fails closed when the asset manifest drifts away from the verified build', async () => {
  await assert.rejects(
    createRovoAutomationScraper().run({
      fetchText: async (url) => {
        if (url === BARE_COMPANY_URL || url === CAREERS_ROUTE_URL) return officialHomepageHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async (url) => {
        assert.equal(url, ASSET_MANIFEST_URL)
        return {
          files: {
            'main.js': '/static/js/new-build.js',
          },
        }
      },
    }),
    /Rovo Automation asset manifest no longer matches the verified non-listing build/i,
  )
})

test('run fails closed when the verified bundle starts advertising hiring content', async () => {
  await assert.rejects(
    createRovoAutomationScraper().run({
      fetchText: async (url) => {
        if (url === BARE_COMPANY_URL || url === CAREERS_ROUTE_URL) return officialHomepageHtml
        if (url === `https://rovoautomation.com${MAIN_JS_PATH}`) {
          return `${verifiedBundle} careers join us apply now`
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => JSON.parse(verifiedAssetManifest),
    }),
    /Rovo Automation bundle no longer matches the verified non-listing surface/i,
  )
})
