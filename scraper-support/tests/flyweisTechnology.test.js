import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Flyweis Technology</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about-us/">About</a>
      <a href="/services/">Services</a>
      <a href="/blog/">BLOG</a>
      <a href="/portfolio/">PORTFOLIO</a>
      <a href="/contact/">Contact</a>
    </nav>
    <main>
      <h1>Artificial Intelligence</h1>
      <h2>We are an end-to-end IT services agency providing turnkey solutions for your business</h2>
      <p>Project Completed</p>
      <p>Team Members</p>
      <p>Flyweis Technology</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/flyweistechnology/script.js')
  } catch {
    assert.fail('Expected Flyweis Technology scraper module at ../../scraper/flyweistechnology/script.js')
  }
}

test('Flyweis Technology helpers stay pinned to the verified marketing homepage with no careers route', async () => {
  const flyweis = await loadModule()

  assert.equal(flyweis.HOMEPAGE_URL, 'https://www.flyweis.technology/')
  assert.equal(flyweis.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(flyweis.hasCareersSignal(homepageHtml), false)
})

test('Flyweis Technology run stays fail-closed while the verified first-party site has no public careers surface', async () => {
  const flyweis = await loadModule()

  const jobs = await flyweis.createFlyweisTechnologyScraper().run({
    fetchText: async () => homepageHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Flyweis Technology fails closed when a careers route appears on the homepage', async () => {
  const flyweis = await loadModule()

  await assert.rejects(
    flyweis.createFlyweisTechnologyScraper().run({
      fetchText: async () => `${homepageHtml}<a href="/careers">Careers</a>`,
    }),
    /public careers surface/i,
  )
})
