import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Ingenero | Engineering, AI & Energy Consulting Jobs</title>
  </head>
  <body>
    <main>
      <h1>Careers at Ingenero</h1>
      <h2>CV Submission Form</h2>
      <label>Name</label>
      <label>Email</label>
      <label>Upload CV</label>
      <p>Mumbai Office</p>
      <p>Ingenero Technologies (India) Pvt. Ltd.</p>
      <p>india@ingenero.com</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ingenerotechnologies/script.js')
  } catch {
    assert.fail('Expected Ingenero Technologies scraper module at ../../scraper/ingenerotechnologies/script.js')
  }
}

test('Ingenero Technologies helpers stay pinned to the verified CV-submission-only careers page', async () => {
  const ingenero = await loadModule()

  assert.equal(ingenero.CAREERS_URL, 'https://ingenero.com/career/')
  assert.equal(ingenero.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(ingenero.hasPublicJobListings(careersHtml), false)
})

test('Ingenero Technologies run stays fail-closed while the verified first-party page remains a CV intake form', async () => {
  const ingenero = await loadModule()

  const jobs = await ingenero.createIngeneroTechnologiesScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Ingenero Technologies fails closed when public job signals appear', async () => {
  const ingenero = await loadModule()

  await assert.rejects(
    ingenero.createIngeneroTechnologiesScraper().run({
      fetchText: async () => `${careersHtml}<section><h2>Current Openings</h2><a href="/job/123">Apply Now</a></section>`,
    }),
    /public job listings/i,
  )
})
