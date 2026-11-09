import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_URL = 'https://storeking.in/'
const ABOUT_URL = 'https://storeking.in/about'
const CONTACT_URL = 'https://storeking.in/contact'
const CAREERS_URL = 'https://storeking.in/careers'
const CAREER_URL = 'https://storeking.in/career'
const JOBS_URL = 'https://storeking.in/jobs'

const homepageHtml = `
  <html>
    <head>
      <title>StoreKing - AI-Powered Digital Retail OS. Turning Kirana Stores into Bright Stores - Direct to Consumers</title>
      <link rel="canonical" href="https://storeking.in" />
    </head>
    <body>
      <h1>AI-Powered Retail OS - For Stores. To Consumers.</h1>
      <p>ANY STORE.</p>
      <p>ONLINE.5 MINUTES.</p>
      <p>Turning Kirana Stores into Bright Stores</p>
      <footer>Localcube Commerce Pvt Ltd <a href="https://storeking.in/contact">Contact us</a></footer>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head>
      <title>StoreKing Retail OS - About Us | StoreKing</title>
    </head>
    <body>
      <p>Since 2015, we've been solving real problems for real store owners.</p>
      <h2>Be Part of the StoreKing Story</h2>
      <a href="https://storeking.in/contact">Explore Careers</a>
      <footer><a href="https://storeking.in/contact">Contact us</a></footer>
    </body>
  </html>
`

const contactHtml = `
  <html>
    <head>
      <title>StoreKing Retail OS - Contact &amp; Retailer Registration | StoreKing</title>
    </head>
    <body>
      <p>Localcube Commerce Pvt Ltd</p>
      <p>hello@storeking.in</p>
      <h2>How Can We Help You Today?</h2>
      <p>Job Seeker</p>
    </body>
  </html>
`

const missingRouteHtml = `
  <html>
    <head>
      <title>StoreKing - AI-Powered Digital Retail OS. Turning Kirana Stores into Bright Stores - Direct to Consumers</title>
      <link rel="canonical" href="https://storeking.in" />
    </head>
    <body>
      <h1>404</h1>
      <p>Page not found</p>
    </body>
  </html>
`

const loadStoreKingModule = async () => {
  try {
    return await import('../../scraper/storeking/script.js')
  } catch {
    assert.fail('Expected StoreKing scraper module at ../../scraper/storeking/script.js')
  }
}

test('StoreKing sentinel helpers stay pinned to the current official homepage, about, contact, and missing-route surfaces', async () => {
  const storeKing = await loadStoreKingModule()

  assert.equal(storeKing.SOURCE, 'storeking')
  assert.equal(storeKing.COMPANY, 'StoreKing')
  assert.equal(storeKing.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(storeKing.ABOUT_URL, ABOUT_URL)
  assert.equal(storeKing.CONTACT_URL, CONTACT_URL)
  assert.equal(storeKing.CAREERS_URL, CAREERS_URL)
  assert.equal(storeKing.CAREER_URL, CAREER_URL)
  assert.equal(storeKing.JOBS_URL, JOBS_URL)
  assert.equal(storeKing.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(storeKing.hasAboutPageSignal(aboutHtml), true)
  assert.equal(storeKing.hasContactPageSignal(contactHtml), true)
  assert.equal(storeKing.hasVerifiedMissingRouteSignal(missingRouteHtml), true)
  assert.equal(storeKing.hasOfficialHomepageSignal('<html><body>StoreKing only</body></html>'), false)
})

test('StoreKing missing-route helper accepts both 404 fetch errors and rendered 404 pages', async () => {
  const storeKing = await loadStoreKingModule()

  assert.equal(
    storeKing.isVerifiedMissingRouteError(new Error(`HTTP 404 for ${CAREER_URL}`), CAREER_URL),
    true,
  )
  assert.equal(
    storeKing.isVerifiedMissingRouteError(new Error(`HTTP 500 for ${CAREER_URL}`), CAREER_URL),
    false,
  )
})

test('StoreKing sentinel returns [] when the current homepage, about, and contact pages stay healthy and careers routes stay missing', async () => {
  const storeKing = await loadStoreKingModule()
  const requested = []

  const jobs = await storeKing.createStoreKingScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === ABOUT_URL) return aboutHtml
      if (url === CONTACT_URL) return contactHtml
      if (url === CAREERS_URL) return missingRouteHtml
      throw new Error(`HTTP 404 for ${url}`)
    },
  })

  assert.deepEqual(requested, [
    ABOUT_URL,
    CONTACT_URL,
    CAREERS_URL,
    CAREER_URL,
    JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})
