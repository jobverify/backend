import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Mindteck | AI, IoT & Product Engineering Solutions</title>
  </head>
  <body>
    <main>
      <h1>Engineering possibilities with AI, IoT, and product engineering</h1>
      <a href="/contact-us">Contact</a>
    </main>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers | Mindteck</title>
  </head>
  <body>
    <main>
      <h1>Step into a world of opportunities</h1>
      <p>Discover career opportunities that match your ambitions at Mindteck.</p>
      <a href="/job-search">Explore Open Positions</a>
    </main>
  </body>
</html>
`

const ZERO_JOBS_SEARCH_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Search | Mindteck</title>
  </head>
  <body>
    <main>
      <h1>Global Engineering and Technology Solutions Company</h1>
      <p>Delivering Knowledge That Matters</p>
      <footer>All Rights Reserved</footer>
    </main>
  </body>
</html>
`

const NON_ZERO_JOBS_SEARCH_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Search | Mindteck</title>
  </head>
  <body>
    <main>
      <h1>Global Engineering and Technology Solutions Company</h1>
      <p>Delivering Knowledge That Matters</p>
      <a href="/job-search/senior-software-engineer">Senior Software Engineer</a>
      <footer>All Rights Reserved</footer>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/mindteck/script.js')
  } catch {
    assert.fail('Expected Mindteck scraper module at ../../scraper/mindteck/script.js')
  }
}

test('Mindteck script stays pinned to the verified official homepage, careers handoff, and zero-jobs job-search shell', async () => {
  const mindteck = await loadModule()

  assert.equal(mindteck.SOURCE, 'mindteck')
  assert.equal(mindteck.COMPANY, 'Mindteck')
  assert.equal(mindteck.HOMEPAGE_URL, 'https://www.mindteck.com/')
  assert.equal(mindteck.CAREERS_URL, 'https://careers.mindteck.com/')
  assert.equal(mindteck.JOB_SEARCH_URL, 'https://careers.mindteck.com/job-search')
  assert.equal(mindteck.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(mindteck.hasOfficialHomepageSignal('<html><title>Other Company</title></html>'), false)
  assert.equal(mindteck.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(mindteck.hasOfficialCareersSignal('<html><body>No careers copy</body></html>'), false)
  assert.equal(mindteck.extractJobSearchUrl(CAREERS_HTML), mindteck.JOB_SEARCH_URL)
  assert.equal(mindteck.extractJobSearchUrl('<html><body>No links</body></html>'), null)
  assert.equal(mindteck.hasZeroJobsShellSignal(ZERO_JOBS_SEARCH_HTML), true)
  assert.equal(mindteck.hasZeroJobsShellSignal(NON_ZERO_JOBS_SEARCH_HTML), false)
})

test('Mindteck returns [] only while the verified public job-search surface remains a zero-jobs shell', async () => {
  const mindteck = await loadModule()
  const requestedUrls = []

  const jobs = await mindteck.createMindteckScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === mindteck.HOMEPAGE_URL) {
        return HOMEPAGE_HTML
      }

      if (url === mindteck.CAREERS_URL) {
        return CAREERS_HTML
      }

      if (url === mindteck.JOB_SEARCH_URL) {
        return ZERO_JOBS_SEARCH_HTML
      }

      throw new Error(`Unexpected Mindteck URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mindteck.HOMEPAGE_URL,
    mindteck.CAREERS_URL,
    mindteck.JOB_SEARCH_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Mindteck fails closed when the homepage, careers handoff, or zero-jobs shell drifts', async () => {
  const mindteck = await loadModule()

  await assert.rejects(
    mindteck.createMindteckScraper().run({
      fetchText: async (url) => {
        if (url === mindteck.HOMEPAGE_URL) {
          return '<html><title>Unexpected</title></html>'
        }

        if (url === mindteck.CAREERS_URL) {
          return CAREERS_HTML
        }

        return ZERO_JOBS_SEARCH_HTML
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    mindteck.createMindteckScraper().run({
      fetchText: async (url) => {
        if (url === mindteck.HOMEPAGE_URL) {
          return HOMEPAGE_HTML
        }

        if (url === mindteck.CAREERS_URL) {
          return '<html><body>Explore roles</body></html>'
        }

        return ZERO_JOBS_SEARCH_HTML
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    mindteck.createMindteckScraper().run({
      fetchText: async (url) => {
        if (url === mindteck.HOMEPAGE_URL) {
          return HOMEPAGE_HTML
        }

        if (url === mindteck.CAREERS_URL) {
          return CAREERS_HTML.replace('/job-search', '/roles')
        }

        return ZERO_JOBS_SEARCH_HTML
      },
    }),
    /job-search route/i,
  )

  await assert.rejects(
    mindteck.createMindteckScraper().run({
      fetchText: async (url) => {
        if (url === mindteck.HOMEPAGE_URL) {
          return HOMEPAGE_HTML
        }

        if (url === mindteck.CAREERS_URL) {
          return CAREERS_HTML
        }

        return NON_ZERO_JOBS_SEARCH_HTML
      },
    }),
    /exposes jobs/i,
  )
})
