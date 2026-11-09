import assert from 'node:assert/strict'
import test from 'node:test'

const loadDrivesAndMotionsModule = async () => {
  try {
    return await import('../../scraper/drivesandmotions/script.js')
  } catch {
    assert.fail('Expected Drives and Motions scraper module at ../../scraper/drivesandmotions/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Drives and Motions</title>
  </head>
  <body>
    <main>
      <h1>Drives and Motions</h1>
      <p>Motion-control systems and industrial automation solutions.</p>
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
    </main>
  </body>
</html>
`

test('Drives and Motions validates the official public site before returning no listings', async () => {
  const drivesAndMotions = await loadDrivesAndMotionsModule()

  assert.equal(drivesAndMotions.HOMEPAGE_URL, 'https://drivesandmotions.com/')
  assert.equal(drivesAndMotions.hasOfficialDrivesAndMotionsSignal(homepageHtml), true)
  assert.equal(drivesAndMotions.hasPublicJobBoardSignal(homepageHtml), false)
})

test('Drives and Motions returns an empty set when no public careers surface exists on the official site', async () => {
  const drivesAndMotions = await loadDrivesAndMotionsModule()
  const requestedUrls = []

  const jobs = await drivesAndMotions.createDrivesAndMotionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === drivesAndMotions.HOMEPAGE_URL) return homepageHtml
      throw new Error(`Unexpected Drives and Motions fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [drivesAndMotions.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})
