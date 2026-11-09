import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Get Hired by Futran Solutions | Explore Openings</title>
  </head>
  <body>
    <h1>ALWAYS BE</h1>
    <h2>Careers</h2>
    <h2>Submit Your Profile</h2>
    <p>Futran Solutions is an Equal Opportunity Employer</p>
  </body>
</html>
`

const liveJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Roles</h1>
    <article data-job-id="fut-101">
      <h2>Data Engineer</h2>
      <a href="/careers/data-engineer">Apply now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/futransolutions/script.js')
  } catch {
    assert.fail('Expected Futran Solutions scraper module at ../../scraper/futransolutions/script.js')
  }
}

test('Futran Solutions helpers stay pinned to the verified careers page without public job listings', async () => {
  const futran = await loadModule()

  assert.equal(futran.SOURCE, 'futransolutions')
  assert.equal(futran.COMPANY, 'Futran Solutions')
  assert.equal(futran.CAREERS_URL, 'https://futransolutions.com/careers/')
  assert.equal(futran.VERIFIED_ON, '2026-07-17')
  assert.equal(futran.hasVerifiedCareersSignal(verifiedCareersHtml), true)
  assert.equal(futran.hasPublicJobListingSignal(verifiedCareersHtml), false)
  assert.equal(futran.hasPublicJobListingSignal(liveJobsHtml), true)
})

test('Futran Solutions returns no jobs while the verified page remains a submit-profile intake surface', async () => {
  const futran = await loadModule()
  const requestedUrls = []

  const jobs = await futran.createFutranSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [futran.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Futran Solutions fails closed when the verified careers page drifts or starts exposing public job listings', async () => {
  const futran = await loadModule()

  await assert.rejects(
    futran.createFutranSolutionsScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified Futran careers page/i,
  )

  await assert.rejects(
    futran.createFutranSolutionsScraper().run({
      fetchText: async () => liveJobsHtml,
    }),
    /live public job listings/i,
  )
})
