import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://mywaggle.com/" />
    <title>Waggle | #1 RV &amp; Pet Monitoring Devices | Waggle®</title>
  </head>
  <body>
    <h1>Waggle</h1>
    <p>Built for Pets, Trusted by Pet Parents!</p>
    <p>855-983-5566</p>
    <p>support@mywaggle.com</p>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found &ndash; Waggle</title>
  </head>
  <body class="template-404 error-404">
    <h1>404</h1>
    <h3>Sorry! Page you are looking can’t be found.</h3>
    <p>Go back to the <a href="/" rel="home">homepage</a></p>
    <footer>
      <p>855-983-5566</p>
      <p>support@mywaggle.com</p>
    </footer>
  </body>
</html>
`

const MISSING_ROUTE_PAGE = {
  status: 404,
  url: 'https://mywaggle.com/pages/careers',
  html: MISSING_ROUTE_HTML,
}

const PUBLIC_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Waggle</title>
  </head>
  <body>
    <h1>Join our team</h1>
    <a href="https://boards.greenhouse.io/waggle/jobs/123">Apply now</a>
  </body>
</html>
`

const loadMywaggleModule = async () => {
  try {
    return await import('../../scraper/mywaggle/script.js')
  } catch {
    assert.fail('Expected Mywaggle scraper module at ../../scraper/mywaggle/script.js')
  }
}

test('Mywaggle constants and validators stay pinned to the verified homepage and branded 404 routes', async () => {
  const mywaggle = await loadMywaggleModule()

  assert.equal(mywaggle.SOURCE, 'mywaggle')
  assert.equal(mywaggle.COMPANY, 'Mywaggle')
  assert.equal(mywaggle.HOMEPAGE_URL, 'https://mywaggle.com/')
  assert.equal(mywaggle.CAREERS_PAGE_URL, 'https://mywaggle.com/pages/careers')
  assert.equal(mywaggle.JOBS_PAGE_URL, 'https://mywaggle.com/pages/jobs')
  assert.equal(mywaggle.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(mywaggle.isVerifiedMissingJobsRoute(MISSING_ROUTE_PAGE), true)
  assert.equal(mywaggle.hasRecruitingSignal(HOMEPAGE_HTML), false)
  assert.equal(mywaggle.hasRecruitingSignal(PUBLIC_CAREERS_HTML), true)
})

test('Mywaggle returns [] when the homepage stays clean and both checked job routes remain verified 404s', async () => {
  const mywaggle = await loadMywaggleModule()
  const requestedUrls = []

  const jobs = await mywaggle.createMywaggleScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === mywaggle.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
      if (url === mywaggle.CAREERS_PAGE_URL) return { status: 404, url, html: MISSING_ROUTE_HTML }
      if (url === mywaggle.JOBS_PAGE_URL) return { status: 404, url, html: MISSING_ROUTE_HTML }
      throw new Error(`Unexpected Mywaggle URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://mywaggle.com/',
    'https://mywaggle.com/pages/careers',
    'https://mywaggle.com/pages/jobs',
  ])
  assert.deepEqual(jobs, [])
})

test('Mywaggle fails closed when the careers route starts exposing a public recruiting surface', async () => {
  const mywaggle = await loadMywaggleModule()

  await assert.rejects(
    mywaggle.createMywaggleScraper().run({
      fetchPage: async (url) => {
        if (url === mywaggle.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === mywaggle.CAREERS_PAGE_URL) return { status: 200, url, html: PUBLIC_CAREERS_HTML }
        if (url === mywaggle.JOBS_PAGE_URL) return { status: 404, url, html: MISSING_ROUTE_HTML }
        throw new Error(`Unexpected Mywaggle URL: ${url}`)
      },
    }),
    /verified 404 surface/i,
  )
})
