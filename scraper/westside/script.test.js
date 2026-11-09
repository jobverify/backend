import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FIRST_PARTY_ROOT_URL,
  createWestsideScraper,
  hasVerifiedOfficialSurface,
} from './script.js'

const homepageHtml = `
  <html>
    <head><title>Westside - Fashion and Lifestyle</title></head>
    <body>
      <h1>Westside</h1>
      <p>India's fashion and lifestyle destination.</p>
    </body>
  </html>
`

const homepageHtmlWithGenericApplyLanguage = `
  <html>
    <head><title>Westside - A Tata Enterprise | Best Online Shopping Site in India</title></head>
    <body>
      <h1>Westside</h1>
      <p>Discover fashion, beauty, and home essentials online.</p>
      <button>Apply Coupon</button>
    </body>
  </html>
`

test('official surface helper requires the Westside first-party brand signal', () => {
  assert.equal(hasVerifiedOfficialSurface(homepageHtml), true)
  assert.equal(hasVerifiedOfficialSurface(homepageHtmlWithGenericApplyLanguage), true)
  assert.equal(hasVerifiedOfficialSurface('<html><body>Careers</body></html>'), false)
})

test('run returns no jobs when the official Westside surface has no public careers feed', async () => {
  const requestedUrls = []
  const jobs = await createWestsideScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, FIRST_PARTY_ROOT_URL)
      return homepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [FIRST_PARTY_ROOT_URL])
  assert.deepEqual(jobs, [])
})
