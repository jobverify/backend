import assert from 'node:assert/strict'
import test from 'node:test'

const loadTechnovertModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Technovert scraper module at ./script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Build what matters. Grow where it counts.</h1>
    <section>Why Tezo</section>
    <section>Current Openings</section>
    <a href="https://www.tezo.com/careers">Careers</a>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>We are Tezo</h1>
    <p>Tezo doing business as Technovert</p>
  </body>
</html>
`

const tezoCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Life is too short to do mediocre work</h1>
    <p>Skills matter some. Attitude matters most.</p>
    <section>Current Openings</section>
    <a href="https://tezo.kekahire.com/jobdetails/136023">Inside Sales Executive Intern</a>
  </body>
</html>
`

test('Technovert recognizes the verified Tezo rebrand handoff contract', async () => {
  const technovert = await loadTechnovertModule()

  assert.equal(technovert.SOURCE, 'technovert')
  assert.equal(technovert.hasVerifiedExactNameCareersSignal(careersHtml, technovert.CAREERS_URL), true)
  assert.equal(technovert.hasVerifiedRebrandSignal(aboutHtml), true)
  assert.equal(technovert.hasVerifiedTezoCareersHandoff(tezoCareersHtml, technovert.TEZO_CAREERS_URL), true)
  assert.deepEqual(
    technovert.extractTrustedJobLinks(tezoCareersHtml, technovert.TEZO_CAREERS_URL),
    ['https://tezo.kekahire.com/jobdetails/136023'],
  )
})

test('Technovert falls back to browser-loaded contract pages when Node fetches are blocked', async () => {
  const technovert = await loadTechnovertModule()

  const jobs = await technovert.createTechnovertScraper().run({
    fetchHtml: async () => {
      throw new Error('HTTP 403 for https://org.tezo.com/about-us/')
    },
    loadBrowserContract: async () => ({
      careersHtml,
      aboutHtml,
      tezoCareersHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Technovert fails closed when the browser-loaded contract changes too', async () => {
  const technovert = await loadTechnovertModule()

  await assert.rejects(
    technovert.createTechnovertScraper().run({
      fetchHtml: async () => {
        throw new Error('HTTP 403 for https://org.tezo.com/about-us/')
      },
      loadBrowserContract: async () => ({
        careersHtml: '<main><h1>Careers</h1></main>',
        aboutHtml,
        tezoCareersHtml,
      }),
    }),
    /verified exact-name careers handoff/i,
  )
})
