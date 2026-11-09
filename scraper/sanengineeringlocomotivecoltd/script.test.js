import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createSanEngineeringLocomotiveCoLtdScraper,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
  hasPublicJobListingSignal,
} from './script.js'

const officialHomepageHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <title> SAN Engineering and Locomotive Co. Ltd.</title>
      <meta content="San Engineering" name="description">
    </head>
    <body>
      <nav>
        <a href="https://san-engineering.com/careers-2/">CAREERS</a>
      </nav>
      <main>
        <h2>Products Engineered and Built To Last</h2>
        <p>
          San Engineering is a leading manufacturer of locomotives, power packs, gear boxes,
          cardan shafts and a variety of innovative and technologically superior rail products.
        </p>
      </main>
    </body>
  </html>
`

const officialCareersHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <title>  CAREERS : SAN Engineering and Locomotive Co. Ltd.</title>
    </head>
    <body>
      <nav>
        <a href="https://san-engineering.com/careers-2/" aria-current="page">CAREERS</a>
      </nav>
      <div class="page-in-bread">
        <span>You are here: </span><a href="https://san-engineering.com" title="Home Page">Home</a>  \\  CAREERS
      </div>
      <section id="page-3925">
        <p class="wp-block-paragraph">APPLY FOR JOB</p>
        <p class="wp-block-paragraph">
          You may email your resume to
          <a href="mailto:careers@san-engineering.com">careers@san-engineering.com</a>
        </p>
      </section>
    </body>
  </html>
`

test('SAN Engineering helpers recognize the verified homepage and email-only careers surface', () => {
  assert.equal(HOMEPAGE_URL, 'https://san-engineering.com/')
  assert.equal(CAREERS_URL, 'https://san-engineering.com/careers-2/')
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(hasPublicJobListingSignal(officialCareersHtml), false)
})

test('SAN Engineering sentinel returns no jobs when the verified first-party careers page remains email-only', async () => {
  const requestedUrls = []
  const jobs = await createSanEngineeringLocomotiveCoLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return officialHomepageHtml
      if (url === CAREERS_URL) return officialCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('SAN Engineering sentinel fails closed when the verified careers page starts exposing public job listings', async () => {
  const careersWithListing = `${officialCareersHtml}
    <section class="current-openings">
      <h2>Current Openings</h2>
      <a href="https://san-engineering.com/jobs/loco-design-engineer/">Loco Design Engineer</a>
    </section>
  `

  await assert.rejects(
    createSanEngineeringLocomotiveCoLtdScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return officialHomepageHtml
        if (url === CAREERS_URL) return careersWithListing

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job listings/i,
  )
})

test('SAN Engineering sentinel fails closed when the homepage stops matching the verified first-party surface', async () => {
  await assert.rejects(
    createSanEngineeringLocomotiveCoLtdScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>Coming soon</body></html>'
        }

        if (url === CAREERS_URL) return officialCareersHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified official surface/i,
  )
})
