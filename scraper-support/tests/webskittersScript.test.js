import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      var WpjbData = {"no_jobs_found":"No job listings found"};
    </script>
    <div class="wpjb-job-list wpjb-grid">
      <h3 class="h5-title">No job listings found.</h3>
    </div>
    <input
      type="text"
      value="https://www.webskitters.com/wpjobboard/xml/rss/?filter=active&hide_filled=0"
      name="feed"
    />
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <div class="wpjb-job-list wpjb-grid">
      <article class="job-card">
        <h3 class="h5-title">Senior PHP Developer</h3>
      </article>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/webskitters/script.js')
  } catch {
    assert.fail('Expected Webskitters scraper module at ../../scraper/webskitters/script.js')
  }
}

test('Webskitters sentinel helpers stay pinned to the verified first-party WPJobBoard empty state from Saturday, July 18, 2026', async () => {
  const webskitters = await loadModule()

  assert.equal(webskitters.SOURCE, 'webskitters')
  assert.equal(webskitters.COMPANY, 'Webskitters')
  assert.equal(webskitters.OFFICIAL_BRAND_NAME, 'Webskitters')
  assert.equal(webskitters.VERIFIED_ON, '2026-07-18')
  assert.equal(webskitters.CAREERS_URL, 'https://www.webskitters.com/career')
  assert.equal(webskitters.hasOfficialEmptyStateSignal(CAREERS_PAGE_HTML), true)
  assert.equal(webskitters.hasPublicJobsSignal(CAREERS_PAGE_HTML), false)
  assert.equal(webskitters.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('Webskitters returns [] only while the verified first-party careers page remains empty', async () => {
  const webskitters = await loadModule()
  const requestedUrls = []

  const jobs = await webskitters.createWebskittersScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === webskitters.CAREERS_URL) return CAREERS_PAGE_HTML
      throw new Error(`Unexpected Webskitters URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [webskitters.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Webskitters fails closed when the verified empty-state page drifts or starts exposing public jobs', async () => {
  const webskitters = await loadModule()

  await assert.rejects(
    webskitters.createWebskittersScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /trusted empty-state surface/i,
  )

  await assert.rejects(
    webskitters.createWebskittersScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /surface now appears to expose public jobs/i,
  )
})
