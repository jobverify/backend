import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Greytrix</title>
  </head>
  <body>
    <main>
      <span>Launch your</span>
      <h2>PROFESSIONAL JOURNEY with us!</h2>
      <h3>Join Us</h3>
      <h2>Job Openings</h2>
      <p>Greytrix official emails only come from <strong>@greytrix.com.</strong></p>
      <a href="/contact/">Contact us</a>
      <iframe src="https://jobs.example.com/embed"></iframe>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/greytrix/script.js')
  } catch {
    assert.fail('Expected Greytrix scraper module at ../../scraper/greytrix/script.js')
  }
}

test('Greytrix accepts the current embedded-jobs shell and still returns no jobs from the first-party page', async () => {
  const greytrix = await loadModule()

  assert.equal(greytrix.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(greytrix.hasEmbeddedJobsShell(careersHtml), true)
  assert.equal(greytrix.hasPublicJobSignals(careersHtml), false)

  const jobs = await greytrix.createGreytrixScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})
