import assert from 'node:assert/strict'
import test from 'node:test'

const loadDigiledgeModule = async () => {
  try {
    return await import('../../scraper/digiledge/script.js')
  } catch {
    assert.fail('Expected Digiledge scraper module at ../../scraper/digiledge/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digiledge</title>
  </head>
  <body>
    <main>
      <h1>Digiledge</h1>
      <p>Digital transformation consulting and product engineering.</p>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </main>
  </body>
</html>
`

test('Digiledge retains its historical homepage signal helpers', async () => {
  const digiledge = await loadDigiledgeModule()

  assert.equal(digiledge.HOMEPAGE_URL, 'https://digiledge.in/')
  assert.equal(digiledge.hasOfficialDigiledgeSignal(homepageHtml), true)
  assert.equal(digiledge.hasPublicJobBoardSignal(homepageHtml), false)
})

// Absence of a link in a supplied homepage body cannot prove a company empty.
test('Digiledge requires original HTTP metadata for its current native redirect chain', async () => {
  const digiledge = await loadDigiledgeModule()
  await assert.rejects(digiledge.createDigiledgeScraper().run({ fetchText: async () => homepageHtml }), /original HTTP metadata|body-only/i)
})
