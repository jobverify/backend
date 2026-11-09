import assert from 'node:assert/strict'
import test from 'node:test'

const loadSampigeSemiconductorsModule = async () => {
  try {
    return await import('../../scraper/sampigesemiconductors/script.js')
  } catch {
    assert.fail('Expected Sampige Semiconductors scraper module at ../../scraper/sampigesemiconductors/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sampige Semiconductors - India's Silicon, for the World</title>
  </head>
  <body>
    <main>
      <h1>India's Silicon, for the World</h1>
      <section>
        <h2>Pioneering India's Semiconductor Future</h2>
        <p>
          Sampige Semiconductors is a fabless semiconductor company designing chipsets that
          reduce dependence on imported silicon.
        </p>
      </section>
      <section>
        <h2>Ready to Build the Future of Silicon?</h2>
        <p>
          Whether you're an engineer exploring an opportunity to join our talented team, or
          simply share our passion for building India's semiconductor future — we'd love to hear
          from you.
        </p>
        <a href="mailto:info@sampigesemi.com">info@sampigesemi.com</a>
      </section>
    </main>
  </body>
</html>
`

const publicJobBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sampige Semiconductors - India's Silicon, for the World</title>
  </head>
  <body>
    <main>
      <h1>India's Silicon, for the World</h1>
      <section>
        <h2>Pioneering India's Semiconductor Future</h2>
        <p>
          Sampige Semiconductors is a fabless semiconductor company designing chipsets that
          reduce dependence on imported silicon.
        </p>
      </section>
      <section>
        <h2>Ready to Build the Future of Silicon?</h2>
        <p>
          Whether you're an engineer exploring an opportunity to join our talented team, or
          simply share our passion for building India's semiconductor future — we'd love to hear
          from you.
        </p>
        <a href="mailto:info@sampigesemi.com">info@sampigesemi.com</a>
      </section>
      <section>
        <a href="https://jobs.ashbyhq.com/sampigesemi/software-engineer">Software Engineer</a>
      </section>
    </main>
  </body>
</html>
`

test('Sampige Semiconductors validates the verified official recruiting homepage before returning no listings', async () => {
  const sampige = await loadSampigeSemiconductorsModule()

  assert.equal(sampige.CAREERS_URL, 'https://sampigesemi.com/')
  assert.equal(sampige.hasOfficialCareersSignal(officialHomepageHtml), true)
  assert.equal(sampige.hasPublicJobBoardSignal(officialHomepageHtml), false)
  assert.equal(sampige.hasPublicJobBoardSignal(publicJobBoardHtml), true)
  assert.deepEqual(sampige.extractSearchResults(officialHomepageHtml), [])
})

test('Sampige Semiconductors returns an empty set while the official public surface only exposes an email recruiting CTA', async () => {
  const sampige = await loadSampigeSemiconductorsModule()
  const requestedUrls = []

  const jobs = await sampige.createSampigeSemiconductorsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sampige.CAREERS_URL) return officialHomepageHtml
      throw new Error(`Unexpected Sampige Semiconductors fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [sampige.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Sampige Semiconductors fails closed when the verified homepage starts exposing a public jobs board', async () => {
  const sampige = await loadSampigeSemiconductorsModule()

  await assert.rejects(
    sampige.createSampigeSemiconductorsScraper().run({
      fetchText: async () => publicJobBoardHtml,
    }),
    /Sampige Semiconductors homepage now appears to expose a public job board/i,
  )
})
