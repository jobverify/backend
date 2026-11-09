import assert from 'node:assert/strict'
import test from 'node:test'

const loadSearsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Sears IT & Management Services India scraper module at ./script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Sears India Careers | Together, Let’s Commit to Excellence</title>
    <link rel="canonical" href="https://searsholdingsindia.in/careers/" />
  </head>
  <body>
    <main>
      <h1>Together, Let’s Commit to Excellence</h1>
      <section>
        <h2>Careers</h2>
        <p>We are hiring for multiple roles across all Business Units and are invested in building long-term careers of value.</p>
      </section>
      <section>
        <h2>Current Openings</h2>
        <div>Pune</div>
        <div>Hyderabad</div>
      </section>
      <footer>
        <a href="/job-disclaimer-notification/">Job Disclaimer</a>
      </footer>
    </main>
  </body>
</html>
`

const structuredJobsHtml = `
${careersHtml}
<article class="job-card">
  <h3>Job Title</h3>
  <a href="/careers/opening/platform-engineer">View Details</a>
</article>
`

test('Sears sentinel pins the current Sears India careers shell', async () => {
  const sears = await loadSearsModule()

  assert.equal(sears.SOURCE, 'searsitmanagementservicesindia')
  assert.equal(sears.CAREERS_URL, 'https://searsholdingsindia.in/careers/')
  assert.equal(sears.hasOfficialSearsCareersSignal(careersHtml), true)
  assert.equal(sears.pageExposesStructuredJobListings(careersHtml), false)
  assert.equal(sears.pageExposesStructuredJobListings(structuredJobsHtml), true)
})

test('Sears sentinel returns [] while the verified first-party careers shell exposes no structured public jobs', async () => {
  const sears = await loadSearsModule()
  const requestedUrls = []

  const jobs = await sears.createSearsITManagementServicesIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [sears.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Sears sentinel fails closed when the careers shell drifts or structured jobs appear', async () => {
  const sears = await loadSearsModule()

  await assert.rejects(
    sears.createSearsITManagementServicesIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Sears Careers</h1></body></html>',
    }),
    /careers shell changed/i,
  )

  await assert.rejects(
    sears.createSearsITManagementServicesIndiaScraper().run({
      fetchText: async () => structuredJobsHtml,
    }),
    /structured public listings/i,
  )
})
