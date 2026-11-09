import assert from 'node:assert/strict'
import test from 'node:test'

const pineLabsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Pine Labs &ndash; Join Our Fintech Innovation Team</title>
    <meta
      name="description"
      content="Explore exciting career opportunities at Pine Labs. Be part of a dynamic fintech company driving innovation in digital payments and merchant solutions."
    />
    <link rel="canonical" href="https://www.pinelabs.com/careers" />
  </head>
  <body>
    <header>
      <a href="/"><img alt="Pine Labs Logo" src="/img/logo.png" /></a>
      <a href="/contact-sales">Contact us</a>
    </header>
    <main>
      <h1>Careers at Pine Labs</h1>
      <p>Join our fintech innovation team</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Qwikcilver sentinel recognizes the verified Pine Labs careers surface with no Qwikcilver jobs signal', async () => {
  const qwikcilver = await loadModule()
  assert.ok(qwikcilver, 'Expected scraper module at ./script.js')

  assert.equal(qwikcilver.SOURCE, 'qwikcilver')
  assert.equal(qwikcilver.COMPANY, 'Qwikcilver')
  assert.equal(qwikcilver.VERIFIED_SURFACE_URL, 'https://www.pinelabs.com/careers')
  assert.equal(qwikcilver.hasVerifiedParentCareersSurface(pineLabsCareersHtml), true)
  assert.equal(
    qwikcilver.hasVerifiedParentCareersSurface(
      pineLabsCareersHtml.replace('&ndash;', '–'),
    ),
    true,
  )
  assert.equal(qwikcilver.hasQwikcilverJobsSignal(pineLabsCareersHtml), false)
  assert.equal(qwikcilver.hasPublicJobBoardSignal(pineLabsCareersHtml), false)
})

test('Qwikcilver sentinel returns no jobs only while the verified no-surface condition remains true', async () => {
  const qwikcilver = await loadModule()
  assert.ok(qwikcilver, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await qwikcilver.createQwikcilverScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === qwikcilver.VERIFIED_SURFACE_URL) {
        return {
          status: 200,
          url,
          html: pineLabsCareersHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [qwikcilver.VERIFIED_SURFACE_URL])
  assert.deepEqual(jobs, [])
})

test('Qwikcilver sentinel fails closed when the verified parent surface drifts or starts exposing Qwikcilver jobs', async () => {
  const qwikcilver = await loadModule()
  assert.ok(qwikcilver, 'Expected scraper module at ./script.js')

  await assert.rejects(
    qwikcilver.createQwikcilverScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified pine labs careers surface/i,
  )

  await assert.rejects(
    qwikcilver.createQwikcilverScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: pineLabsCareersHtml.replace(
          '</main>',
          '<section><h2>Qwikcilver</h2><p>Apply now</p></section></main>',
        ),
      }),
    }),
    /Qwikcilver now appears on the verified Pine Labs careers surface/i,
  )

  await assert.rejects(
    qwikcilver.createQwikcilverScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: pineLabsCareersHtml.replace(
          '</main>',
          '<section><a href="https://jobs.lever.co/pinelabs">Open roles</a></section></main>',
        ),
      }),
    }),
    /public job board signal/i,
  )
})
