import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nativeorange - Agentic Underwriting to Claims on One Platform</title>
  </head>
  <body>
    <a href="https://nativeorange.ai/contact/">Book a Demo</a>
    <h1>One platform for the entire insurance lifecycle</h1>
    <p>AI-powered solutions for carriers and agencies</p>
    <p>A connected suite of agentic-AI products across the value chain</p>
    <p>Google Scale Startup</p>
    <p>GUIDEWIRE Insurtech Vanguard</p>
  </body>
</html>
`

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Nativeorange | AI Insurance Technology Company | Nativeorange</title>
  </head>
  <body>
    <h1>About Us</h1>
    <p>Pioneering intelligent AI solutions to transform businesses and shape the digital future of technology.</p>
    <p>Our team brings experience from AWS, Google, and Microsoft.</p>
    <h2>Join Our Team</h2>
    <p>Nativeorange is always looking for software engineers that can leverage Agentic AI tools to help customers realize their vision.</p>
    <a href="https://nativeorange.ai/contact/">Apply Now</a>
  </body>
</html>
`

const CONTACT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Nativeorange | Schedule a Demo | Get Support | Nativeorange</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p>Our team is ready to help you transform your business with cutting-edge technologies.</p>
    <p>Fill out the form below and our team will get back to you shortly.</p>
    <p>sales@nativeorange.ai</p>
    <p>+1 (925) 399-6005</p>
  </body>
</html>
`

const buildNoJobsRouteHtml = (routePath) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Nativeorange - Agentic Underwriting to Claims on One Platform</title>
  </head>
  <body>
    <a href="https://nativeorange.ai/contact/">Book a Demo</a>
    <a href="https://nativeorange.ai/${routePath}/#">Resources</a>
    <a href="https://nativeorange.ai/${routePath}/#">Privacy Policy</a>
    <a href="https://nativeorange.ai/${routePath}/#">Terms of Service</a>
    <h1>One platform for the entire insurance lifecycle</h1>
    <p>AI-powered solutions for carriers and agencies</p>
    <p>A connected suite of agentic-AI products across the value chain</p>
    <p>Google Scale Startup</p>
    <p>GUIDEWIRE Insurtech Vanguard</p>
  </body>
</html>
`

const CAREERS_ROUTE_HTML = buildNoJobsRouteHtml('careers')
const JOBS_ROUTE_HTML = buildNoJobsRouteHtml('jobs')

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nativeorange Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://boards.greenhouse.io/nativeorange/jobs/123">Apply now</a>
  </body>
</html>
`

const loadNativeOrangeModule = async () => {
  try {
    return await import('../../scraper/nativeorange/script.js')
  } catch {
    assert.fail('Expected Native orange scraper module at ../../scraper/nativeorange/script.js')
  }
}

test('Native orange constants and validators stay pinned to the Thursday, August 13, 2026 no-public-jobs surface', async () => {
  const nativeorange = await loadNativeOrangeModule()

  assert.equal(nativeorange.SOURCE, 'nativeorange')
  assert.equal(nativeorange.COMPANY, 'Native orange')
  assert.equal(nativeorange.VERIFIED_ON, '2026-08-13')
  assert.equal(nativeorange.HOMEPAGE_URL, 'https://nativeorange.ai/')
  assert.equal(nativeorange.ABOUT_URL, 'https://nativeorange.ai/about/')
  assert.equal(nativeorange.CONTACT_URL, 'https://nativeorange.ai/contact/')
  assert.equal(nativeorange.CAREERS_PAGE_URL, 'https://nativeorange.ai/careers/')
  assert.equal(nativeorange.JOBS_PAGE_URL, 'https://nativeorange.ai/jobs/')
  assert.deepEqual(nativeorange.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://nativeorange.ai/careers/',
    'https://nativeorange.ai/jobs/',
  ])
  assert.equal(nativeorange.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(nativeorange.hasOfficialAboutSignal(ABOUT_HTML), true)
  assert.equal(nativeorange.hasOfficialContactSignal(CONTACT_HTML), true)
  assert.equal(nativeorange.extractApplyHandoffUrl(ABOUT_HTML), nativeorange.CONTACT_URL)
  assert.equal(nativeorange.hasPublicJobsSignal(HOMEPAGE_HTML, { currentUrl: nativeorange.HOMEPAGE_URL }), false)
  assert.equal(
    nativeorange.hasPublicJobsSignal(CAREERS_ROUTE_HTML, { currentUrl: nativeorange.CAREERS_PAGE_URL }),
    false,
  )
  assert.equal(
    nativeorange.hasPublicJobsSignal(JOBS_ROUTE_HTML, { currentUrl: nativeorange.JOBS_PAGE_URL }),
    false,
  )
  assert.equal(nativeorange.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
  assert.equal(
    nativeorange.isVerifiedNoJobsRoute({
      status: 200,
      url: nativeorange.CAREERS_PAGE_URL,
      html: CAREERS_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    nativeorange.isVerifiedNoJobsRoute({
      status: 200,
      url: nativeorange.JOBS_PAGE_URL,
      html: JOBS_ROUTE_HTML,
    }),
    true,
  )
})

test('Native orange returns [] when the homepage, about, contact, and marketing routes stay clean', async () => {
  const nativeorange = await loadNativeOrangeModule()
  const requestedUrls = []

  const jobs = await nativeorange.createNativeOrangeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nativeorange.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === nativeorange.ABOUT_URL) {
        return { status: 200, url, html: ABOUT_HTML }
      }

      if (url === nativeorange.CONTACT_URL) {
        return { status: 200, url, html: CONTACT_HTML }
      }

      if (url === nativeorange.CAREERS_PAGE_URL) {
        return { status: 200, url, html: CAREERS_ROUTE_HTML }
      }

      if (url === nativeorange.JOBS_PAGE_URL) {
        return { status: 200, url, html: JOBS_ROUTE_HTML }
      }

      throw new Error(`Unexpected Native orange URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nativeorange.HOMEPAGE_URL,
    nativeorange.ABOUT_URL,
    nativeorange.CONTACT_URL,
    nativeorange.CAREERS_PAGE_URL,
    nativeorange.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Native orange fails closed when a no-jobs route starts exposing a public recruiting surface', async () => {
  const nativeorange = await loadNativeOrangeModule()

  await assert.rejects(
    nativeorange.createNativeOrangeScraper().run({
      fetchPage: async (url) => {
        if (url === nativeorange.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === nativeorange.ABOUT_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        if (url === nativeorange.CONTACT_URL) {
          return { status: 200, url, html: CONTACT_HTML }
        }

        if (url === nativeorange.CAREERS_PAGE_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === nativeorange.JOBS_PAGE_URL) {
          return { status: 200, url, html: JOBS_ROUTE_HTML }
        }

        throw new Error(`Unexpected Native orange URL: ${url}`)
      },
    }),
    /verified no-jobs route no longer matches the known marketing shell/i,
  )
})
