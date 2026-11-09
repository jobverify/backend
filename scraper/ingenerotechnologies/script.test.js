import assert from 'node:assert/strict'
import test from 'node:test'

const loadIngeneroTechnologiesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ingenero Technologies scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Ingenero | Engineering, AI &amp; Energy Consulting Jobs</title>
    <style>
      .elementor-location-footer:before { content: ""; }
    </style>
  </head>
  <body>
    <main>
      <h1>Career</h1>
      <p>CV Submission Form</p>
      <label>Name</label>
      <label>Email</label>
      <label>Upload CV</label>
      <p>Ingenero Technologies (India) Pvt. Ltd.</p>
    </main>
  </body>
</html>
`

test('Ingenero Technologies accepts the verified CV-submission careers page with an encoded title', async () => {
  const ingenero = await loadIngeneroTechnologiesModule()

  assert.equal(ingenero.SOURCE, 'ingenerotechnologies')
  assert.equal(ingenero.CAREERS_URL, 'https://ingenero.com/career/')
  assert.equal(ingenero.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(ingenero.hasPublicJobListings(officialCareersHtml), false)
})

test('Ingenero Technologies returns no jobs while the verified surface remains a CV-submission form', async () => {
  const ingenero = await loadIngeneroTechnologiesModule()
  const requestedUrls = []

  const jobs = await ingenero.createIngeneroTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [ingenero.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Ingenero Technologies fails closed when the verified surface changes or starts exposing public openings', async () => {
  const ingenero = await loadIngeneroTechnologiesModule()

  await assert.rejects(
    ingenero.createIngeneroTechnologiesScraper().run({
      fetchText: async () => '<main><h1>Careers</h1></main>',
    }),
    /verified ingenero technologies careers page no longer matches/i,
  )

  await assert.rejects(
    ingenero.createIngeneroTechnologiesScraper().run({
      fetchText: async () => `
        ${officialCareersHtml}
        <section>
          <h2>Current Openings</h2>
          <a href="/jobs/process-engineer">Apply now</a>
        </section>
      `,
    }),
    /now exposes public job listings/i,
  )
})
