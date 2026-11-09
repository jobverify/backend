import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  LEGACY_CAREERS_ENQUIRY_URL,
  LEGACY_LIFE_AT_URL,
  SOURCE,
  VERIFIED_ON,
  createElectrosteelCastingsScraper,
  hasBrandedMissingRouteSignal,
  hasCareerInfoOnlySignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Home | Electrosteel Castings Limited</title>
    </head>
    <body>
      <p>MANUFACTURING EXCELLENCE.</p>
      <p>A proud make in india company With Global Outreach</p>
      <p>We are the largest manufacturer of Ductile Iron (DI) Pipes in the Indian sub-continent.</p>
    </body>
  </html>
`

const careerInfoHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Electrosteel</title>
    </head>
    <body>
      <h1>Build the Future with Electrosteel Castings Limited</h1>
      <h2>WHY JOIN ELECTROSTEEL</h2>
      <h2>OUR PROMISE</h2>
      <h2>Explore Opportunities at Electrosteel</h2>
      <h2>Khoj The Campus Drive</h2>
      <h3>Roles Offered Under Khoj</h3>
      <p>Final-year students pursuing B.Tech, MBA, CA, B.Sc., B.A., B.Com., and other relevant disciplines from recognised universities and institutes across India</p>
    </body>
  </html>
`

test('homepage identity survives changes to Electrosteel rotating campaign copy', () => {
  const currentHomepage = homepageHtml.replace('MANUFACTURING EXCELLENCE.', 'SUSTAINABLE TODAY. RESPONSIBLE ALWAYS.')
  assert.equal(hasOfficialHomepageSignal(currentHomepage), true)
  assert.equal(hasOfficialHomepageSignal(currentHomepage.replace('Home | Electrosteel Castings Limited', 'Unrelated company')), false)
})

const missingRouteHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Electrosteel</title>
    </head>
    <body>
      <h1>404 / Page Not Found</h1>
      <p>THIS PAGE IS OFF THE GRID.</p>
      <p>Routing Status 404</p>
      <p>Destination unavailable.</p>
    </body>
  </html>
`

test('validates the Thursday, August 20, 2026 Electrosteel homepage, careers hub, and accepted legacy no-openings routes', async () => {
  const requestedUrls = []
  const scraper = createElectrosteelCastingsScraper()

  assert.equal(SOURCE, 'electrosteelcastings')
  assert.equal(VERIFIED_ON, '2026-08-20')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasCareerInfoOnlySignal(careerInfoHtml), true)
  assert.equal(hasBrandedMissingRouteSignal(missingRouteHtml), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careerInfoHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === LEGACY_CAREERS_ENQUIRY_URL || url === LEGACY_LIFE_AT_URL) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    LEGACY_CAREERS_ENQUIRY_URL,
    LEGACY_LIFE_AT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('accepts the current Electrosteel legacy route redirects when they still resolve to verified official no-openings surfaces', async () => {
  const scraper = createElectrosteelCastingsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careerInfoHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchPage: async (url) => {
      if (url === LEGACY_CAREERS_ENQUIRY_URL) {
        return { status: 200, url: CAREERS_URL, html: careerInfoHtml }
      }

      if (url === LEGACY_LIFE_AT_URL) {
        return { status: 200, url: HOMEPAGE_URL, html: homepageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('fails closed when the Electrosteel homepage, careers hub, or legacy 404 routes drift', async () => {
  await assert.rejects(
    createElectrosteelCastingsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return '<html><body>No manufacturing overview</body></html>'
        }

        return careerInfoHtml
      },
    }),
    /Electrosteel homepage no longer matches the verified official public site/i,
  )

  await assert.rejects(
    createElectrosteelCastingsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return '<html><body>Apply now for open roles</body></html>'
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchPage: async (url) => ({ status: 404, url, html: missingRouteHtml }),
    }),
    /career information page no longer matches the verified official no-openings surface/i,
  )

  await assert.rejects(
    createElectrosteelCastingsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return careerInfoHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchPage: async (url) => {
        if (url === LEGACY_CAREERS_ENQUIRY_URL) {
          return { status: 200, url, html: '<html><body>Open roles listed here</body></html>' }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /legacy careers routes no longer match the verified official no-openings surfaces/i,
  )
})


test('Electrosteel retries transient legacy-route gateway errors and preserves verified 404 responses', async () => {
  const { createFetchPage } = await import('./script.js')
  let calls = 0
  const fetchPage = createFetchPage({ baseDelayMs: 0, fetchImpl: async () => {
    calls += 1
    return calls === 1 ? new Response('Proxy Error', { status: 502 }) : new Response(missingRouteHtml, { status: 404 })
  } })
  const page = await fetchPage(LEGACY_CAREERS_ENQUIRY_URL)
  assert.equal(calls, 2)
  assert.equal(page.status, 404)
  assert.equal(hasBrandedMissingRouteSignal(page.html), true)
  await assert.rejects(createFetchPage({ attempts: 2, baseDelayMs: 0,
    fetchImpl: async () => new Response('Proxy Error', { status: 502 }) })(LEGACY_CAREERS_ENQUIRY_URL), /HTTP 502/)
})
