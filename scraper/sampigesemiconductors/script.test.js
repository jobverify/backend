import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createSampigeSemiconductorsScraper,
  hasOfficialCareersSignal,
  hasPublicJobBoardSignal,
} from './script.js'

const officialHomepageHtml = `
  <html>
    <head>
      <title>Sampige Semiconductors — India's Silicon, for the World</title>
    </head>
    <body>
      <h1>India's Silicon, for the World</h1>
      <p>Sampige Semiconductors is a fabless semiconductor company.</p>
      <p>If you are an engineer exploring an opportunity to join our talented team, reach out to us.</p>
      <a href="mailto:info@sampigesemi.com">info@sampigesemi.com</a>
    </body>
  </html>
`

const publicBoardHtml = `
  <html>
    <head>
      <title>Sampige Semiconductors — India's Silicon, for the World</title>
    </head>
    <body>
      <h1>India's Silicon, for the World</h1>
      <p>Sampige Semiconductors is a fabless semiconductor company.</p>
      <p>If you are an engineer exploring an opportunity to join our talented team, reach out to us.</p>
      <a href="mailto:info@sampigesemi.com">info@sampigesemi.com</a>
      <a href="/careers/design-engineer">Apply now</a>
    </body>
  </html>
`

test('Sampige Semiconductors verifier accepts the current homepage punctuation', () => {
  assert.equal(hasOfficialCareersSignal(officialHomepageHtml), true)
  assert.equal(hasPublicJobBoardSignal(officialHomepageHtml), false)
  assert.equal(hasPublicJobBoardSignal(publicBoardHtml), true)
})

test('Sampige Semiconductors returns an empty set when the verified homepage remains an email-only recruiting surface', async () => {
  const scraper = createSampigeSemiconductorsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return officialHomepageHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Sampige Semiconductors fails closed when a public board appears on the verified homepage', async () => {
  const scraper = createSampigeSemiconductorsScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async () => publicBoardHtml,
    }),
    /public job board/i,
  )
})
