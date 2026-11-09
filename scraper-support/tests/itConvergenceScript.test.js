import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - IT Convergence</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Why IT Convergence</h2>
      <h2>Life at IT Convergence</h2>
      <p>Learn more about our culture and global team.</p>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - IT Convergence</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Solutions Architect"}
    </script>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Current Openings</h2>
      <a href="/jobs/solutions-architect">Apply Now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/itconvergence/script.js')
  } catch {
    assert.fail('Expected IT Convergence scraper module at ../../scraper/itconvergence/script.js')
  }
}

test('IT Convergence sentinel pins the verified first-party careers page and no-public-openings state', async () => {
  const itConvergence = await loadModule()

  assert.equal(itConvergence.SOURCE, 'itconvergence')
  assert.equal(itConvergence.COMPANY, 'IT Convergence')
  assert.equal(itConvergence.OFFICIAL_BRAND_NAME, 'IT Convergence')
  assert.equal(itConvergence.VERIFIED_ON, '2026-07-18')
  assert.equal(itConvergence.CAREERS_URL, 'https://www.itconvergence.com/careers/')
  assert.equal(itConvergence.HOMEPAGE_URL, 'https://www.itconvergence.com/')
  assert.equal(itConvergence.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(itConvergence.hasOfficialCareersSignal('<html><body>Other</body></html>'), false)
  assert.equal(itConvergence.pageExposesPublicJobListings(CAREERS_HTML), false)
  assert.equal(itConvergence.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('IT Convergence stays fail-closed while the first-party careers page exposes no public openings', async () => {
  const itConvergence = await loadModule()
  const jobs = await itConvergence.createItConvergenceScraper().run({
    fetchText: async (url) => {
      assert.equal(url, itConvergence.CAREERS_URL)
      return CAREERS_HTML
    },
  })

  assert.deepEqual(jobs, [])
})

test('IT Convergence fails closed when the careers page drifts or starts exposing public jobs', async () => {
  const itConvergence = await loadModule()

  await assert.rejects(
    itConvergence.createItConvergenceScraper().run({
      fetchText: async () => '<html><body>Unexpected surface</body></html>',
    }),
    /verified IT Convergence careers page/i,
  )

  await assert.rejects(
    itConvergence.createItConvergenceScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /public jobs surface/i,
  )
})
