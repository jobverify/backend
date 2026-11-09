import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current openings</title>
  </head>
  <body>
    <main>
      <h1>All Departments</h1>
      <h2>All Locations</h2>
      <div>Loading...</div>
      <p>No jobs found matching your criteria</p>
      <button id="loadMoreBtn" class="primary-btn">Load More Jobs</button>
      <script type="module" src="https://www.simform.com/wp-content/plugins/kula-job-board/scripts/app.js"></script>
    </main>
  </body>
</html>
`

const HERO_COPY_EMPTY_STATE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current openings</title>
  </head>
  <body>
    <main>
      <p>Apply now, because there's never a perfect time to seize the opportunity.</p>
      <h1>All Departments</h1>
      <h2>All Locations</h2>
      <div>Loading...</div>
      <p>No jobs found matching your criteria</p>
      <button id="loadMoreBtn" class="primary-btn">Load More Jobs</button>
      <script type="module" src="https://www.simform.com/wp-content/plugins/kula-job-board/scripts/app.js"></script>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current openings</title>
  </head>
  <body>
    <main>
      <h1>All Departments</h1>
      <h2>All Locations</h2>
      <article class="job-card">
        <a class="job-title-link" href="/current-openings/senior-engineer">Senior Engineer</a>
        <button>Apply Now</button>
      </article>
      <button id="loadMoreBtn" class="primary-btn">Load More Jobs</button>
      <script type="module" src="https://www.simform.com/wp-content/plugins/kula-job-board/scripts/app.js"></script>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/simform/script.js')
  } catch {
    assert.fail('Expected Simform scraper module at ../../scraper/simform/script.js')
  }
}

test('Simform sentinel pins the verified current-openings empty state', async () => {
  const simform = await loadModule()

  assert.equal(simform.SOURCE, 'simform')
  assert.equal(simform.COMPANY, 'Simform')
  assert.equal(simform.OFFICIAL_BRAND_NAME, 'Simform')
  assert.equal(simform.VERIFIED_ON, '2026-07-18')
  assert.equal(simform.CURRENT_OPENINGS_URL, 'https://www.simform.com/current-openings/')
  assert.equal(simform.OFFICIAL_CAREERS_URL, 'https://www.simform.com/careers/')
  assert.equal(simform.hasVerifiedEmptyState(CURRENT_OPENINGS_HTML), true)
  assert.equal(simform.hasVerifiedEmptyState('<html><body>Other</body></html>'), false)
  assert.equal(simform.pageExposesPublicJobListings(CURRENT_OPENINGS_HTML), false)
  assert.equal(simform.pageExposesPublicJobListings(HERO_COPY_EMPTY_STATE_HTML), false)
  assert.equal(simform.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('Simform returns [] only while the verified current-openings page stays in its empty state', async () => {
  const simform = await loadModule()
  const jobs = await simform.createSimformScraper().run({
    fetchText: async (url) => {
      assert.equal(url, simform.CURRENT_OPENINGS_URL)
      return CURRENT_OPENINGS_HTML
    },
  })

  assert.deepEqual(jobs, [])
})

test('Simform fails closed when the current-openings surface drifts or starts exposing public jobs', async () => {
  const simform = await loadModule()

  await assert.rejects(
    simform.createSimformScraper().run({
      fetchText: async () => '<html><body>Unexpected surface</body></html>',
    }),
    /verified Simform current-openings page/i,
  )

  await assert.rejects(
    simform.createSimformScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /public jobs surface/i,
  )
})
