import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Changing How India invests</h1>
      <p>Join us to shape tomorrow’s investment product layer for India</p>
      <a href="https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222">View Open Positions</a>
      <section>
        <h3>Jobs</h3>
        <p>Come work with us. Write in at work@smallcase.com</p>
      </section>
    </main>
  </body>
</html>
`

const CURRENT_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About | smallcase</title>
  </head>
  <body>
    <main>
      <h1>Changing How India invests</h1>
      <p>Join us to shape tomorrow’s investment product layer for India</p>
      <p>Come work with us. Write in at work@smallcase.com</p>
      <a href="https://app.pyjamahr.com/careers?company=smallcase&amp;company_uuid=2615584222">View Open Positions</a>
    </main>
  </body>
</html>
`

const EMPTY_PYJAMA_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>smallcase</h1>
    <p>smallcase is a leading provider of investment products to Indian investors & platforms to the capital markets industry.</p>
    <p>We are always looking for smart, fun folks to join our team. Write to us at people@smallcase.com</p>
    <h4>Careers at smallcase</h4>
    <label>Department</label>
    <label>Location</label>
    <p>Loading jobs...</p>
    <p>Hiring Powered By</p>
    <p>PyjamaHR</p>
  </body>
</html>
`

const PUBLIC_JOB_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Software Engineer Level II - Backend Development</h1>
    <p>Job ID: 331176</p>
    <a href="https://jobs.pyjamahr.com/smallcase/software-engineer-level-ii-backend-development">See all jobs</a>
    <a href="https://app.pyjamahr.com/careers?company=smallcase&job_id=331176&company_uuid=2615584222&source=DIRECT&apply_now=true">Apply</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/smallcase/script.js')
  } catch {
    assert.fail('Expected Smallcase scraper module at ../../scraper/smallcase/script.js')
  }
}

test('Smallcase sentinel helpers stay pinned to the verified first-party About page and opaque PyjamaHR board state', async () => {
  const smallcase = await loadModule()

  assert.equal(smallcase.SOURCE, 'smallcase')
  assert.equal(smallcase.COMPANY, 'Smallcase')
  assert.equal(smallcase.OFFICIAL_BRAND_NAME, 'smallcase')
  assert.equal(smallcase.VERIFIED_ON, '2026-07-17')
  assert.equal(smallcase.CAREERS_PAGE_URL, 'https://www.smallcase.com/about')
  assert.equal(
    smallcase.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222',
  )
  assert.equal(
    smallcase.VERIFIED_SAMPLE_JOB_URL,
    'https://jobs.pyjamahr.com/smallcase/software-engineer-level-ii-backend-development',
  )
  assert.match(smallcase.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(smallcase.hasOfficialCareersSignal(OFFICIAL_ABOUT_HTML), true)
  assert.equal(
    smallcase.extractOfficialPyjamaHandoffUrl(OFFICIAL_ABOUT_HTML),
    'https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222',
  )
  assert.equal(smallcase.pageExposesPublicJobListings(OFFICIAL_ABOUT_HTML), false)
  assert.equal(smallcase.pageExposesPublicJobListings(EMPTY_PYJAMA_BOARD_HTML), false)
  assert.equal(smallcase.pageExposesPublicJobListings(PUBLIC_JOB_HTML), true)
  assert.equal(
    smallcase.matchesVerifiedOpaquePyjamaState({
      status: 200,
      url: smallcase.OFFICIAL_CAREERS_HANDOFF_URL,
      html: EMPTY_PYJAMA_BOARD_HTML,
    }),
    true,
  )
})

test('Smallcase accepts the current About page handoff when the Pyjama query string is HTML-escaped', async () => {
  const smallcase = await loadModule()

  assert.equal(smallcase.hasOfficialCareersSignal(CURRENT_ABOUT_HTML), true)
  assert.equal(
    smallcase.extractOfficialPyjamaHandoffUrl(CURRENT_ABOUT_HTML),
    'https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222',
  )
})

test('Smallcase returns [] only while the verified first-party About page still hands off to an opaque PyjamaHR board', async () => {
  const smallcase = await loadModule()
  const requestedUrls = []

  const jobs = await smallcase.createSmallcaseScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === smallcase.CAREERS_PAGE_URL) {
        return { status: 200, url, html: OFFICIAL_ABOUT_HTML }
      }

      if (url === smallcase.OFFICIAL_CAREERS_HANDOFF_URL) {
        return { status: 200, url, html: EMPTY_PYJAMA_BOARD_HTML }
      }

      throw new Error(`Unexpected Smallcase URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    smallcase.CAREERS_PAGE_URL,
    smallcase.OFFICIAL_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Smallcase fails closed when the verified official page or PyjamaHR handoff drifts into a parseable board', async () => {
  const smallcase = await loadModule()

  await assert.rejects(
    smallcase.createSmallcaseScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified smallcase about page/i,
  )

  await assert.rejects(
    smallcase.createSmallcaseScraper().run({
      fetchPage: async (url) => {
        if (url === smallcase.CAREERS_PAGE_URL) {
          return { status: 200, url, html: OFFICIAL_ABOUT_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOB_HTML }
      },
    }),
    /pyjamahr handoff state changed materially|appears to expose public jobs/i,
  )
})
