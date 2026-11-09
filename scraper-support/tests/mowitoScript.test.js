import assert from 'node:assert/strict'
import test from 'node:test'

const loadMowitoModule = async () => {
  try {
    return await import('../../scraper/mowito/script.js')
  } catch {
    assert.fail('Expected Mowito scraper module at ../../scraper/mowito/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mowito</title>
  </head>
  <body>
    <main>
      <h1>Reimagining Automation: Human-Like Precision, Fixture-Free</h1>
      <p>Mowito's AI-NeuralPick delivers fast, flexible robotic handling with zero jigs.</p>
      <section>
        <h2>Careers</h2>
        <a href="https://www.linkedin.com/company/mowito/jobs/?viewAsMember=true">LinkedIn</a>
        <a href="mailto:careers@mowito.in">careers@mowito.in</a>
      </section>
      <address>
        No 3, Chandra Layout Main Road, Vijayanagar, Bengaluru, Karnataka 560040, India
      </address>
    </main>
  </body>
</html>
`

test('Mowito validates the official careers contact surface before returning no listings', async () => {
  const mowito = await loadMowitoModule()

  assert.equal(mowito.HOMEPAGE_URL, 'https://www.mowito.ai/')
  assert.equal(mowito.hasOfficialMowitoSignal(homepageHtml), true)
  assert.equal(mowito.hasPublicJobBoardSignal(homepageHtml), false)
})

test('Mowito returns an empty result set when the official site exposes only careers contact signals', async () => {
  const mowito = await loadMowitoModule()
  const requestedUrls = []

  const jobs = await mowito.createMowitoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mowito.HOMEPAGE_URL) return homepageHtml
      throw new Error(`Unexpected Mowito fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [mowito.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Mowito throws when the homepage no longer matches the verified official surface', async () => {
  const mowito = await loadMowitoModule()

  await assert.rejects(
    mowito.createMowitoScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected page</h1></body></html>',
    }),
    /official public surface/i,
  )
})
