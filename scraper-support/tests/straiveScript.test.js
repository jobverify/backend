import assert from 'node:assert/strict'
import test from 'node:test'

const loadStraiveModule = async () => {
  try {
    return await import('../../scraper/straive/script.js')
  } catch {
    assert.fail('Expected Straive scraper module at ../../scraper/straive/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Straive Careers and Job Opportunities | Straive</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Come, be part of our team</p>
      <a href="#careerform">Apply For Job</a>
      <section>
        <h2>Find the Right Career Match for You</h2>
        <p>Straive India Careers</p>
        <a href="mailto:INCareers@straive.com">INCareers@straive.com</a>
        <p>Straive Global Careers</p>
        <a href="mailto:GlobalCareers@straive.com">GlobalCareers@straive.com</a>
      </section>
    </main>
  </body>
</html>
`

test('extractSearchResults returns no jobs when Straive only exposes regional email apply routes on the official careers page', async () => {
  const straive = await loadStraiveModule()

  assert.equal(straive.CAREERS_URL, 'https://www.straive.com/careers/')
  assert.equal(straive.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(straive.hasPublicJobBoardSignal(careersHtml), false)
  assert.deepEqual(straive.extractSearchResults(careersHtml), [])
})

test('run validates the verified Straive careers surface and returns an empty result set', async () => {
  const straive = await loadStraiveModule()
  const requestedUrls = []

  const jobs = await straive.createStraiveScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === straive.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Straive fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [straive.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
