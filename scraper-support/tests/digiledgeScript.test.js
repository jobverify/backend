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

test('Digiledge validates the official public site before returning no listings', async () => {
  const digiledge = await loadDigiledgeModule()

  assert.equal(digiledge.HOMEPAGE_URL, 'https://digiledge.in/')
  assert.equal(digiledge.hasOfficialDigiledgeSignal(homepageHtml), true)
  assert.equal(digiledge.hasPublicJobBoardSignal(homepageHtml), false)
})

test('Digiledge returns an empty set when no public careers surface exists on the official site', async () => {
  const digiledge = await loadDigiledgeModule()
  const requestedUrls = []

  const jobs = await digiledge.createDigiledgeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === digiledge.HOMEPAGE_URL) return homepageHtml
      throw new Error(`Unexpected Digiledge fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [digiledge.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})
