import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createBsesScraper,
  hasOfficialBsesPageShape,
} from './script.js'

const officialLandingPageHtml = `
  <html>
    <head><title>BSES</title></head>
    <body>
      <h1>Home - BSES</h1>
      <a href="/web/brpl">BSES Rajdhani Power Ltd</a>
      <a href="/web/bypl">BSES Yamuna Power Ltd</a>
    </body>
  </html>
`

test('validates the official BSES landing page shape', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.bsesdelhi.com/')
  assert.equal(hasOfficialBsesPageShape(officialLandingPageHtml), true)
  assert.equal(hasOfficialBsesPageShape('<main>BSES Rajdhani Power Ltd</main>'), false)
})

test('returns no jobs only after validating the official public landing page', async () => {
  const requestedUrls = []
  const jobs = await createBsesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialLandingPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('fails closed when the fetched page is not the official BSES landing page', async () => {
  await assert.rejects(
    createBsesScraper().run({ fetchText: async () => '<html><body>Unavailable</body></html>' }),
    /BSES official landing page shape/i,
  )
})
