import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Web Accessibility, Marketing & Data Solutions | Tranistics</title>
  </head>
  <body>
    <h1>Your business. Our responsibility.</h1>
    <p>Tranistics: Revolutionizing transportation and logistics</p>
    <footer>Copyright © 2026 Tranistics Data Technologies Pvt. Ltd</footer>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - Tranistics Data Technologies</title>
  </head>
  <body>
    <h1>Contact us</h1>
    <p>info@tranistics.com</p>
    <p>Kolkata</p>
    <p>Noida</p>
  </body>
</html>
`

const brandedNotFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found - Tranistics Data Technologies</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <p>Skip to content</p>
    <p>Search for:</p>
  </body>
</html>
`

test('Tranistics recognizes the verified homepage, contact page, and current branded missing-route template', async () => {
  const tranistics = await loadModule()

  assert.equal(tranistics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tranistics.hasOfficialContactSignal(contactHtml), true)
})

test('Tranistics returns no jobs while common careers routes still resolve to the current branded 404 template', async () => {
  const tranistics = await loadModule()

  const jobs = await tranistics.createTranisticsDataTechnologiesScraper().run({
    fetchPage: async (url) => {
      if (url === tranistics.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === tranistics.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (tranistics.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: brandedNotFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
