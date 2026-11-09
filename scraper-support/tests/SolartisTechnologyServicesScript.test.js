import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us | Careers</title>
  </head>
  <body>
    <main>
      <h1>We are growing fast! Do you have what it takes to be a Solartian?</h1>
      <p>Contact us today!</p>
      <p>Chennai and Madurai, India</p>
      <p>careers-india@solartis.com</p>
      <a href="/contact-us/">Get Started</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/solartistechnologyservices/script.js')
  } catch {
    assert.fail('Expected Solartis Technology Services scraper module at ../../scraper/solartistechnologyservices/script.js')
  }
}

test('Solartis Technology Services fails closed on the verified careers contact page with no public job cards', async () => {
  const solartis = await loadModule()

  assert.equal(solartis.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(solartis.pageExposesStructuredJobListings(careersHtml), false)

  const jobs = await solartis.createSolartisTechnologyServicesScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    solartis.createSolartisTechnologyServicesScraper().run({
      fetchText: async () => careersHtml.replace('</main>', '<article class="job-card"><h2>Software Engineer</h2></article></main>'),
    }),
    /structured public job listings/i,
  )
})
