import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/calsoft/script.js')
  } catch {
    assert.fail('Expected Calsoft scraper module at ../../scraper/calsoft/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Calsoft - Build Your Future in AI & Digital Engineering</title>
  </head>
  <body>
    <h1>Evolve with Calsoft</h1>
    <p>Open vacancies</p>
    <p>0 Results</p>
    <h3>No jobs found</h3>
    <p>Try adjusting your search or filter criteria to find what you're looking for.</p>
  </body>
</html>
`

test('Calsoft validates the verified zero-openings first-party surface and returns no jobs', async () => {
  const calsoft = await loadModule()

  assert.equal(calsoft.SOURCE, 'calsoft')
  assert.equal(calsoft.COMPANY, 'Calsoft')
  assert.equal(calsoft.CAREERS_URL, 'https://www.calsoftinc.com/career')
  assert.equal(calsoft.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(calsoft.hasZeroResultsSignal(careersHtml), true)
  assert.equal(calsoft.hasTrustworthyPublicJobsSignal(careersHtml), false)

  const jobs = await calsoft.createCalsoftScraper().run({
    fetchText: async (url) => {
      assert.equal(url, calsoft.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Calsoft fails closed if public job cards appear on the exact-name surface', async () => {
  const calsoft = await loadModule()

  await assert.rejects(
    calsoft.createCalsoftScraper().run({
      fetchText: async () => `
        ${careersHtml}
        <section class="job-card">
          <h2>Platform Engineer</h2>
          <a href="https://www.calsoftinc.com/career/platform-engineer">Apply now</a>
        </section>
      `,
    }),
    /trustworthy public jobs surface/i,
  )
})

test('Calsoft fails when the verified zero-openings shell disappears', async () => {
  const calsoft = await loadModule()

  await assert.rejects(
    calsoft.createCalsoftScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /trusted first-party surface/i,
  )
})
