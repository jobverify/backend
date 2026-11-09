import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings - Grow Your Career with Extraordinary Symphony Team</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Grow your career with our extraordinary Symphony team. Search for roles and opportunities that better suit your career path.</p>
      <p>There are no current openings. Please check this space later.</p>
    </main>
  </body>
</html>
`

const DRIFTED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current Openings</h1>
      <article>
        <h2>Regional Sales Manager</h2>
        <a href="/careers/regional-sales-manager/">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/symphony/script.js')
  } catch {
    assert.fail('Expected Symphony scraper module at ../../scraper/symphony/script.js')
  }
}

test('Symphony sentinel helpers stay pinned to the verified first-party no-openings careers page', async () => {
  const symphony = await loadModule()

  assert.equal(symphony.SOURCE, 'symphony')
  assert.equal(symphony.COMPANY, 'Symphony')
  assert.equal(symphony.OFFICIAL_BRAND_NAME, 'Symphony Limited')
  assert.equal(symphony.CAREERS_PAGE_URL, 'https://symphonylimited.com/careers/current-openings/')
  assert.equal(symphony.VERIFIED_ON, '2026-08-05')
  assert.match(symphony.VERIFIED_SURFACE_SUMMARY, /no jobs/i)
  assert.equal(symphony.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(symphony.pageStillHasNoCurrentOpenings(OFFICIAL_CAREERS_HTML), true)
  assert.equal(symphony.hasOfficialCareersSignal(DRIFTED_CAREERS_HTML), false)
  assert.equal(symphony.pageStillHasNoCurrentOpenings(DRIFTED_CAREERS_HTML), false)
})

test('Symphony returns [] only while the verified careers page still exposes the no-openings sentinel state', async () => {
  const symphony = await loadModule()
  const requestedUrls = []

  const jobs = await symphony.createSymphonyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === symphony.CAREERS_PAGE_URL) return OFFICIAL_CAREERS_HTML

      throw new Error(`Unexpected Symphony URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [symphony.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Symphony fails closed when the verified careers page drifts into a different public surface', async () => {
  const symphony = await loadModule()

  await assert.rejects(
    symphony.createSymphonyScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    symphony.createSymphonyScraper().run({
      fetchText: async () => DRIFTED_CAREERS_HTML,
    }),
    /verified careers page/i,
  )
})
