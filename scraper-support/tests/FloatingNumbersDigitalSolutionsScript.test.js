import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Floating Numbers</title>
  </head>
  <body>
    <main>
      <h1>The best content moderation company in india</h1>
      <h2>We're moderation experts - We are here to help you</h2>
      <h2>Committed to team excellence</h2>
      <p>Floating Numbers has been delivering valuable and practical solutions to protect children, online communities, and clients' brands since 2018.</p>
      <a href="/about/">About</a>
      <a href="/services/">Services</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/floatingnumbersdigitalsolutions/script.js')
  } catch {
    assert.fail('Expected Floating Numbers Digital Solutions scraper module at ../../scraper/floatingnumbersdigitalsolutions/script.js')
  }
}

test('Floating Numbers Digital Solutions remains fail-closed on the verified marketing homepage', async () => {
  const floatingNumbers = await loadModule()

  assert.equal(floatingNumbers.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(floatingNumbers.pageExposesPublicJobSignals(homepageHtml), false)

  const jobs = await floatingNumbers.createFloatingNumbersDigitalSolutionsScraper().run({
    fetchText: async () => homepageHtml,
  })

  assert.deepEqual(jobs, [])
})
