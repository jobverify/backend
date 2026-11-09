import assert from 'node:assert/strict'
import test from 'node:test'

const loadCuemathModule = async () => {
  try {
    return await import('../../scraper/cuemath/script.js')
  } catch {
    assert.fail('Expected Cuemath scraper module at ../../scraper/scraper/cuemath/script.js')
  }
}

const tutorApplicationPageHtml = `
  <html>
    <head>
      <title>Cuemath Tutor Screening</title>
      <link rel="canonical" href="https://tutorhiring.cuemath.com/" />
    </head>
    <body>
      <h1>Become a Cuemath Tutor</h1>
      <p>Join 4,000+ Cuemath coaches across 20+ countries.</p>
      <p>Start your application</p>
      <p>5-minute application · Completely free</p>
      <button>Signup</button>
    </body>
  </html>
`

test('run returns no jobs when Cuemath exposes a tutor application flow without public job records', async () => {
  const cuemath = await loadCuemathModule()
  const requestedUrls = []

  assert.equal(cuemath.hasTutorApplicationSignal(tutorApplicationPageHtml), true)
  assert.deepEqual(cuemath.extractJobs(tutorApplicationPageHtml), [])

  const jobs = await cuemath.createCuemathScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return tutorApplicationPageHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://tutorhiring.cuemath.com/'])
  assert.deepEqual(jobs, [])
})
