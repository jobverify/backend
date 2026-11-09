import assert from 'node:assert/strict'
import test from 'node:test'

const parkedHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>gulfasia.com&nbsp;-&nbsp;This website is for sale!&nbsp;-&nbsp;gulfasia Resources and Information.</title>
    <meta name="description" content="This website is for sale! gulfasia.com is your first and best source for information about gulfasia.">
  </head>
  <body>
    <img src="https://img.sedoparking.com/templates/logos/sedo_logo.png" alt="Sedo">
    <script src="https://euob.iseaskies.com/sxp/i/581749a3c1e7922374ca9b3d4dff0407.js"></script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/gulfasia/script.js')
  } catch {
    assert.fail('Expected Gulf Asia scraper module at ../../scraper/gulfasia/script.js')
  }
}

test('Gulf Asia accepts the apex parked-domain no-jobs surface', async () => {
  const gulfasia = await loadModule()

  assert.equal(gulfasia.hasParkedDomainSignal(parkedHtml), true)
  assert.equal(gulfasia.hasPublicJobBoardSignal(parkedHtml), false)

  const jobs = await gulfasia.createGulfAsiaScraper().run({
    fetchText: async () => parkedHtml,
  })

  assert.deepEqual(jobs, [])
})
