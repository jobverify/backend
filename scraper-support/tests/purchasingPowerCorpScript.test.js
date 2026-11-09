import assert from 'node:assert/strict'
import test from 'node:test'

const shellHtml = (nonce = '10') => `
<!doctype html>
<html lang="en" data-beasties-container>
  <head>
    <title>Purchasing Power</title>
    <base href="/">
    <link rel="stylesheet" href="https://ui.purchasingpower.com/spartacus/styles-abc.css">
  </head>
  <body>
    <app-root></app-root>
    <script src="https://ui.purchasingpower.com/spartacus/main-abc.js"></script>
    <script src="/_Incapsula_Resource?ns=${nonce}&cb=123" async></script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/purchasingpowercorp/script.js')
  } catch {
    assert.fail('Expected Purchasing Power Corp scraper module at ../../scraper/purchasingpowercorp/script.js')
  }
}

test('Purchasing Power Corp accepts dynamic SPA fallback shells only while they expose no jobs', async () => {
  const purchasingPower = await loadModule()
  const homepageHtml = shellHtml('10')
  const routeHtml = shellHtml('9')

  assert.equal(purchasingPower.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(purchasingPower.isVerifiedRouteFallbackShell(routeHtml, homepageHtml), true)
  assert.equal(
    purchasingPower.isVerifiedRouteFallbackShell(
      `${routeHtml}<a href="https://jobs.lever.co/purchasingpower">Apply now</a>`,
      homepageHtml,
    ),
    false,
  )

  const jobs = await purchasingPower.createPurchasingPowerCorpScraper().run({
    fetchPage: async (url, options = {}) => {
      if (url === purchasingPower.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === purchasingPower.ROBOTS_URL) {
        return { status: 404, url, html: '404' }
      }

      if (url === purchasingPower.SITEMAP_URL) {
        return { status: 200, url, html: '<urlset><url><loc>https://www.purchasingpower.com/about</loc></url></urlset>' }
      }

      if (purchasingPower.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: routeHtml }
      }

      if (url === purchasingPower.LEGACY_CAREERS_HOST_URL && options.manualRedirect) {
        return {
          status: 302,
          url,
          headers: { location: purchasingPower.LEGACY_CAREERS_TARGET_URL },
          html: '',
        }
      }

      if (url === purchasingPower.LEGACY_CAREERS_TARGET_URL) {
        return { status: 200, url, html: routeHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
