import assert from 'node:assert/strict'
import test from 'node:test'

const pineLabsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Pine Labs - Join Our Fintech Innovation Team</title>
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
      <p>Join our fintech innovation team.</p>
    </main>
  </body>
</html>
`

const pineLabsWithJobsHtml = `
${pineLabsCareersHtml.replace(
  '</main>',
  `
    <section>
      <h2>Open roles</h2>
      <a href="https://jobs.lever.co/pinelabs/backend-engineer">Apply now</a>
    </section>
  </main>`,
)}
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pinelabs/script.js')
  } catch {
    assert.fail('Expected Pine Labs scraper module at ../../scraper/pinelabs/script.js')
  }
}

test('Pine Labs sentinel recognizes the verified first-party careers surface with no public board signal', async () => {
  const pinelabs = await loadModule()

  assert.equal(pinelabs.SOURCE, 'pinelabs')
  assert.equal(pinelabs.COMPANY, 'Pine Labs')
  assert.equal(pinelabs.OFFICIAL_BRAND_NAME, 'Pine Labs')
  assert.equal(pinelabs.VERIFIED_ON, '2026-07-17')
  assert.equal(pinelabs.HOMEPAGE_URL, 'https://www.pinelabs.com/')
  assert.equal(pinelabs.CAREERS_URL, 'https://www.pinelabs.com/careers')
  assert.match(pinelabs.VERIFIED_SURFACE_SUMMARY, /Careers at Pine Labs/i)

  assert.match(pinelabs.normalizeWhitespace(pineLabsCareersHtml), /Join our fintech innovation team/i)
  assert.equal(pinelabs.hasVerifiedCareersSurface(pineLabsCareersHtml), true)
  assert.equal(pinelabs.hasPublicJobsSignal(pineLabsCareersHtml), false)
  assert.equal(pinelabs.hasPublicJobsSignal(pineLabsWithJobsHtml), true)
})

test('Pine Labs returns [] only while the official careers page remains a no-public-board surface', async () => {
  const pinelabs = await loadModule()
  const requestedUrls = []

  const jobs = await pinelabs.createPineLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pinelabs.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: pineLabsCareersHtml,
        }
      }

      throw new Error(`Unexpected Pine Labs URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [pinelabs.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Pine Labs fails closed when the verified careers surface drifts or starts exposing public jobs', async () => {
  const pinelabs = await loadModule()

  await assert.rejects(
    pinelabs.createPineLabsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /careers surface/i,
  )

  await assert.rejects(
    pinelabs.createPineLabsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: pineLabsWithJobsHtml,
      }),
    }),
    /public jobs/i,
  )
})
