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

test('Mowito retains its historical corporate contact signal helpers', async () => {
  const mowito = await loadMowitoModule()

  assert.equal(mowito.HOMEPAGE_URL, 'https://www.mowito.ai/')
  assert.equal(mowito.hasOfficialMowitoSignal(homepageHtml), true)
  assert.equal(mowito.hasPublicJobBoardSignal(homepageHtml), false)
})

// The employer actually delegates Careers to LinkedIn. Its inventory remains
// unknown until original HTTP acquisition succeeds; a body is not empty proof.
test('Mowito rejects body-only career-contact pages rather than declaring empty', async () => {
  const mowito = await loadMowitoModule()
  await assert.rejects(mowito.createMowitoScraper().run({ fetchText: async () => homepageHtml }), /original HTTP metadata|body-only/i)
})

test('Mowito retains the historical official-surface negative check', async () => {
  const mowito = await loadMowitoModule()
  assert.equal(mowito.hasOfficialMowitoSignal('<html><body><h1>Unexpected page</h1></body></html>'), false)
})
