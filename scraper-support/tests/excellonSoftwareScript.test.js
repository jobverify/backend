import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work with us | Excellon Careers</title>
  </head>
  <body>
    <h1>Join a Team That’s Redefining Growth and Challenging the Status Quo</h1>
    <p>Apply Now</p>
    <h2>Submit Job Application</h2>
    <p>Life at Excellon is more than a career—it’s a journey of growth, innovation, and making a difference.</p>
  </body>
</html>
`

const liveJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <article data-job-id="exc-001">
      <h2>Software Engineer</h2>
      <a href="/jobs/software-engineer">Apply now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/excellonsoftware/script.js')
  } catch {
    assert.fail('Expected Excellon Software scraper module at ../../scraper/excellonsoftware/script.js')
  }
}

test('Excellon Software helpers stay pinned to the verified careers page without public job listings', async () => {
  const excellon = await loadModule()

  assert.equal(excellon.SOURCE, 'excellonsoftware')
  assert.equal(excellon.COMPANY, 'Excellon Software')
  assert.equal(excellon.CAREERS_URL, 'https://www.excellonsoft.com/about/careers/')
  assert.equal(excellon.VERIFIED_ON, '2026-07-17')
  assert.equal(excellon.hasVerifiedCareersSignal(verifiedCareersHtml), true)
  assert.equal(excellon.hasPublicJobListingSignal(verifiedCareersHtml), false)
  assert.equal(excellon.hasPublicJobListingSignal(liveJobsHtml), true)
})

test('Excellon Software returns no jobs while the verified careers page remains a general application surface', async () => {
  const excellon = await loadModule()
  const requestedUrls = []

  const jobs = await excellon.createExcellonSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [excellon.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Excellon Software fails closed when the verified page drifts or starts exposing live job listings', async () => {
  const excellon = await loadModule()

  await assert.rejects(
    excellon.createExcellonSoftwareScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified Excellon careers page/i,
  )

  await assert.rejects(
    excellon.createExcellonSoftwareScraper().run({
      fetchText: async () => liveJobsHtml,
    }),
    /live public job listings/i,
  )
})
