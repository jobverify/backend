import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title data-wf-page="home">Empower Your Sales with AI | Salesken.ai</title>
  </head>
  <body>
    <header>
      <a href="/product/ai-sales-assistant">Product</a>
      <a href="/pricing">Pricing</a>
      <a href="/book-a-demo">Request a Demo</a>
      <a href="/legal/privacy-policy">Privacy Policy</a>
      <a href="/legal/terms-conditions">Terms &amp; Conditions</a>
    </header>
    <main>
      <h1>Empower Your Sales with AI</h1>
      <p>Coach every rep in real time and improve revenue outcomes.</p>
    </main>
  </body>
</html>
`

const LEGACY_HOMEPAGE_HTML = HOMEPAGE_HTML.replace('Request a Demo', 'Book a demo')

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found</title>
  </head>
  <body>
    <h1>NOT_FOUND</h1>
    <p>The page could not be found.</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Salesken</title>
  </head>
  <body>
    <h1>Join our team</h1>
    <h2>Current Openings</h2>
    <a href="https://jobs.example.com/salesken/backend-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/salesken/script.js')
  } catch {
    assert.fail('Expected Salesken scraper module at ../../scraper/salesken/script.js')
  }
}

test('Salesken sentinel helpers stay pinned to the verified homepage and missing careers routes', async () => {
  const salesken = await loadModule()

  assert.equal(salesken.SOURCE, 'salesken')
  assert.equal(salesken.COMPANY, 'Salesken')
  assert.equal(salesken.OFFICIAL_BRAND_NAME, 'Salesken')
  assert.equal(salesken.VERIFIED_ON, '2026-07-17')
  assert.equal(salesken.HOMEPAGE_URL, 'https://www.salesken.ai/')
  assert.equal(salesken.CAREERS_PAGE_URL, 'https://www.salesken.ai/careers')
  assert.equal(salesken.JOBS_PAGE_URL, 'https://www.salesken.ai/jobs')
  assert.equal(salesken.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(salesken.hasOfficialHomepageSignal(LEGACY_HOMEPAGE_HTML), true)
  assert.equal(salesken.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(
    salesken.isVerifiedMissingRouteResponse({ status: 404, html: MISSING_ROUTE_HTML }),
    true,
  )
  assert.equal(salesken.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('Salesken returns [] only while the verified exact-name site stays a product homepage with missing careers routes', async () => {
  const salesken = await loadModule()
  const requestedUrls = []

  const jobs = await salesken.createSaleskenScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === salesken.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === salesken.CAREERS_PAGE_URL || url === salesken.JOBS_PAGE_URL) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      throw new Error(`Unexpected Salesken URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    salesken.HOMEPAGE_URL,
    salesken.CAREERS_PAGE_URL,
    salesken.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Salesken fails closed when the homepage drifts or a missing route turns into a public jobs surface', async () => {
  const salesken = await loadModule()

  await assert.rejects(
    salesken.createSaleskenScraper().run({
      fetchPage: async (url) => {
        if (url === salesken.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    salesken.createSaleskenScraper().run({
      fetchPage: async (url) => {
        if (url === salesken.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === salesken.CAREERS_PAGE_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /surface now appears to expose public jobs/i,
  )

  await assert.rejects(
    salesken.createSaleskenScraper().run({
      fetchPage: async (url) => {
        if (url === salesken.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === salesken.CAREERS_PAGE_URL) {
          return { status: 200, url, html: MISSING_ROUTE_HTML }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /verified missing careers route/i,
  )
})
