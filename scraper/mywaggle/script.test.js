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
  <html lang="en">
    <head>
      <title>Waggle | #1 RV & Pet Monitoring Devices | Waggle</title>
      <link rel="canonical" href="https://mywaggle.com/">
    </head>
    <body class="template-index">
      <main>
        <h1>Built for Pets, Trusted by Pet Parents!</h1>
        <p>Keep your pet safe with real-time temperature alerts and GPS tracking.</p>
      </main>
      <footer>
        <p>855-983-5566</p>
        <p>support@mywaggle.com</p>
      </footer>
    </body>
  </html>
`

const missingJobsRouteHtml = `
  <html lang="en">
    <head>
      <title>404 Not Found - Waggle</title>
      <link rel="canonical" href="https://mywaggle.com/404">
    </head>
    <body class="template-404">
      <main class="error-404 not-found">
        <h1 class="error-404-title">404</h1>
        <h3 class="error-404-subtext">Sorry! Page you are looking can’t be found.</h3>
        <p class="error-404-link">Go back to the <a href="/" rel="home">homepage</a></p>
      </main>
      <footer>
        <p>855-983-5566</p>
        <p>support@mywaggle.com</p>
      </footer>
    </body>
  </html>
`

const homepageWithRecruitingSignalHtml = `
  <html lang="en">
    <head>
      <title>Waggle | #1 RV & Pet Monitoring Devices | Waggle</title>
      <link rel="canonical" href="https://mywaggle.com/">
    </head>
    <body class="template-index">
      <main>
        <h1>Built for Pets, Trusted by Pet Parents!</h1>
        <a href="/pages/careers">Careers</a>
        <p>We are hiring for multiple open roles.</p>
      </main>
      <footer>
        <p>855-983-5566</p>
        <p>support@mywaggle.com</p>
      </footer>
    </body>
  </html>
`

const careersLandingHtml = `
  <html lang="en">
    <head>
      <title>Careers at Waggle</title>
    </head>
    <body>
      <main>
        <h1>Open Positions</h1>
      </main>
    </body>
  </html>
`

test('Mywaggle sentinel helpers stay pinned to the verified July 13, 2026 first-party surface', async () => {
  const mywaggle = await loadModule()
  assert.ok(mywaggle, 'Mywaggle scraper module should load')

  assert.equal(mywaggle.SOURCE, 'mywaggle')
  assert.equal(mywaggle.COMPANY, 'Mywaggle')
  assert.equal(mywaggle.HOMEPAGE_URL, 'https://mywaggle.com/')
  assert.equal(mywaggle.CAREERS_PAGE_URL, 'https://mywaggle.com/pages/careers')
  assert.equal(mywaggle.JOBS_PAGE_URL, 'https://mywaggle.com/pages/jobs')
  assert.equal(mywaggle.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mywaggle.hasRecruitingSignal(homepageHtml), false)
  assert.equal(mywaggle.isVerifiedMissingJobsRoute(missingJobsRouteHtml), true)
})

test('run returns [] only while the verified Mywaggle homepage and checked routes stay in the no-jobs state', async () => {
  const mywaggle = await loadModule()
  assert.ok(mywaggle, 'Mywaggle scraper module should load')

  const requestedUrls = []
  const jobs = await mywaggle.createMywaggleScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mywaggle.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === mywaggle.CAREERS_PAGE_URL) return { status: 404, url, html: missingJobsRouteHtml }
      if (url === mywaggle.JOBS_PAGE_URL) return { status: 404, url, html: missingJobsRouteHtml }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mywaggle.HOMEPAGE_URL,
    mywaggle.CAREERS_PAGE_URL,
    mywaggle.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Mywaggle starts exposing a recruiting signal on the homepage', async () => {
  const mywaggle = await loadModule()
  assert.ok(mywaggle, 'Mywaggle scraper module should load')

  await assert.rejects(
    mywaggle.createMywaggleScraper().run({
      fetchPage: async (url) => {
        if (url === mywaggle.HOMEPAGE_URL) return { status: 200, url, html: homepageWithRecruitingSignalHtml }
        if (url === mywaggle.CAREERS_PAGE_URL) return { status: 404, url, html: missingJobsRouteHtml }
        if (url === mywaggle.JOBS_PAGE_URL) return { status: 404, url, html: missingJobsRouteHtml }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified no-public-jobs surface/i,
  )
})

test('run fails closed when a checked Mywaggle route stops being the verified 404 surface', async () => {
  const mywaggle = await loadModule()
  assert.ok(mywaggle, 'Mywaggle scraper module should load')

  await assert.rejects(
    mywaggle.createMywaggleScraper().run({
      fetchPage: async (url) => {
        if (url === mywaggle.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === mywaggle.CAREERS_PAGE_URL) return { status: 200, url, html: careersLandingHtml }
        if (url === mywaggle.JOBS_PAGE_URL) return { status: 404, url, html: missingJobsRouteHtml }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked careers route no longer matches the verified 404 surface/i,
  )
})
