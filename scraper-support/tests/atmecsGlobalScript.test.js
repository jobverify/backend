import assert from 'node:assert/strict'
import test from 'node:test'

const JOBS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - ATMECS</title>
  </head>
  <body>
    <h1>Jobs</h1>
    <p>[jobs]</p>
    <footer>ATMECS Global</footer>
  </body>
</html>
`

const JOBS_PAGE_WITH_PUBLIC_LISTING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - ATMECS</title>
  </head>
  <body>
    <h1>Jobs</h1>
    <article class="job-card">
      <h2>Platform Engineer</h2>
      <a href="https://atmecs.com/careers/platform-engineer">Apply now</a>
    </article>
  </body>
</html>
`

const JOBS_PAGE_WITH_CAREERS_NAV_LINK_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - ATMECS</title>
  </head>
  <body>
    <nav>
      <a href="https://atmecs.com/careers/">Careers</a>
    </nav>
    <h1>Jobs</h1>
    <p>[jobs]</p>
    <footer>ATMECS Global</footer>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/atmecsglobal/script.js')
  } catch {
    assert.fail('Expected ATMECS Global scraper module at ../../scraper/atmecsglobal/script.js')
  }
}

test('ATMECS Global sentinel helpers stay pinned to the verified placeholder-only jobs page from Saturday, July 18, 2026', async () => {
  const atmecs = await loadModule()

  assert.equal(atmecs.SOURCE, 'atmecsglobal')
  assert.equal(atmecs.COMPANY, 'ATMECS Global')
  assert.equal(atmecs.OFFICIAL_BRAND_NAME, 'ATMECS Global')
  assert.equal(atmecs.VERIFIED_ON, '2026-07-28')
  assert.equal(atmecs.HOMEPAGE_URL, 'https://atmecs.com/')
  assert.equal(atmecs.CAREERS_URL, 'https://atmecs.com/jobs/')
  assert.equal(atmecs.isTrustedUnavailableFailure(new Error('getaddrinfo ENOTFOUND atmecs.com')), true)
  assert.equal(atmecs.isTrustedUnavailableFailure(new Error('net::ERR_FAILED at https://atmecs.com/jobs/')), true)
  assert.equal(atmecs.hasOfficialJobsShellSignal(JOBS_PAGE_HTML), true)
  assert.equal(atmecs.hasPublicJobsSignal(JOBS_PAGE_HTML), false)
  assert.equal(atmecs.hasPublicJobsSignal(JOBS_PAGE_WITH_CAREERS_NAV_LINK_HTML), false)
  assert.equal(atmecs.hasPublicJobsSignal(JOBS_PAGE_WITH_PUBLIC_LISTING_HTML), true)
})

test('ATMECS Global returns [] only while the verified first-party jobs page stays placeholder-only', async () => {
  const atmecs = await loadModule()
  const requestedUrls = []

  const jobs = await atmecs.createAtmecsGlobalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === atmecs.CAREERS_URL) return JOBS_PAGE_HTML
      throw new Error(`Unexpected ATMECS Global URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [atmecs.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('ATMECS Global fails closed when the verified jobs shell drifts or starts exposing public jobs', async () => {
  const atmecs = await loadModule()

  await assert.rejects(
    atmecs.createAtmecsGlobalScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified first-party jobs page/i,
  )

  await assert.rejects(
    atmecs.createAtmecsGlobalScraper().run({
      fetchText: async () => JOBS_PAGE_WITH_PUBLIC_LISTING_HTML,
    }),
    /surface now appears to expose public jobs/i,
  )
})

test('ATMECS Global stays API-only and treats trusted host unavailability as an empty result without browser fallback', async () => {
  const atmecs = await loadModule()

  const jobs = await atmecs.createAtmecsGlobalScraper().run({
    fetchText: async () => {
      throw new Error('fetch failed | getaddrinfo ENOTFOUND atmecs.com')
    },
  })

  assert.deepEqual(jobs, [])
})

test('ATMECS Global stays fail-closed when the pinned first-party jobs host is now unavailable', async () => {
  const atmecs = await loadModule()

  const jobs = await atmecs.createAtmecsGlobalScraper().run({
    fetchText: async () => {
      throw new Error('fetch failed | getaddrinfo ENOTFOUND atmecs.com')
    },
  })

  assert.deepEqual(jobs, [])
})
