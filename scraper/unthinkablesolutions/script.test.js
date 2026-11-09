import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Unthinkable Solutions</title>
  </head>
  <body>
    <h1>Believe in being Fundamentally different?</h1>
    <p>Come, be a part of team that challenges the status quo.</p>
    <section>Our Commitment to You</section>
    <section>Open Vacancies</section>
    <p>List of available open vacancies for unthinkable</p>
  </body>
</html>
`

test('Unthinkable Solutions recognizes the current first-party careers shell and still sees no structured public listings', async () => {
  const unthinkable = await loadModule()

  assert.equal(unthinkable.hasOfficialUnthinkableCareersSignal(careersHtml), true)
  assert.equal(unthinkable.pageExposesStructuredJobListings(careersHtml), false)
})

test('Unthinkable Solutions returns no jobs while the current careers page remains an unstructured vacancies shell', async () => {
  const unthinkable = await loadModule()

  const jobs = await unthinkable.createUnthinkableSolutionsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, unthinkable.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})
