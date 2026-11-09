import assert from 'node:assert/strict'
import test from 'node:test'

const homepageShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Destek Infosolutions</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="assets/img/Destek-logo-final.png" />
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.js" type="module"></script>
    <script src="polyfills.js" type="module"></script>
    <script src="vendor.js" type="module"></script>
    <script src="main.js" type="module"></script>
  </body>
</html>
`

const appBundleText = `
Destek Infosolutions
contactus@desteksolutions.com
Office no 202B, Town Square, Off New Airport Road, Viman Nagar, Pune 411014
Custom Software Development
Head - HR & Operations
`

const missingRouteHtml = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/destekinfosolutions/script.js')
  } catch {
    assert.fail('Expected Destek Infosolutions scraper module at ../../scraper/destekinfosolutions/script.js')
  }
}

test('Destek Infosolutions validates the verified no-public-careers homepage shell, app bundle, and missing routes', async () => {
  const destek = await loadModule()

  assert.equal(destek.hasOfficialHomepageSignal(homepageShellHtml), true)
  assert.equal(destek.hasPublicCareersLink(homepageShellHtml), false)
  assert.equal(destek.extractAppBundleUrl(homepageShellHtml), destek.APP_BUNDLE_URL)
  assert.equal(destek.hasOfficialAppBundleSignal(appBundleText), true)
  assert.equal(
    destek.isExpectedMissingRoute({
      status: 404,
      url: 'https://desteksolutions.com/careers',
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Destek Infosolutions run returns no jobs while the verified first-party no-public-careers SPA surface remains unchanged', async () => {
  const destek = await loadModule()
  const requestedUrls = []

  const jobs = await destek.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === destek.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageShellHtml, headers: {} }
      }
      if (url === destek.APP_BUNDLE_URL) {
        return { status: 200, url, html: appBundleText, headers: {} }
      }
      if (destek.MISSING_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: missingRouteHtml,
          headers: {},
        }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    destek.HOMEPAGE_URL,
    destek.APP_BUNDLE_URL,
    ...destek.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
