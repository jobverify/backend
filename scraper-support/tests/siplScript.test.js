import assert from 'node:assert/strict'
import test from 'node:test'

const loadSIPLModule = async () => {
  try {
    return await import('../../scraper/sipl/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>SIPL - SIPL Pvt Ltd</title>
      <meta name="description" content="SIPL Pvt Ltd is an established and reputed firm in the Sustainable domain since 2008. We provide consultancy services like LCA/EPD/GHG/CFP." />
    </head>
    <body>
      <h1>SIPL Pvt Ltd</h1>
      <p>Sustainable domain consultancy since 2008.</p>
    </body>
  </html>
`

const contactHtml = `
  <html>
    <head>
      <title>Contact Us - SIPL Pvt Ltd</title>
      <meta property="og:description" content="Office Address: SIPL Pvt. Ltd., Noida, India +91 9911921666 support@siplsustainability.onmicrosoft.com" />
    </head>
    <body>
      <h1>Contact Us</h1>
      <p>support@siplsustainability.onmicrosoft.com</p>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head>
      <meta name="description" content="SIPL Pvt Ltd - Leading sustainability consultancy in India since 2008. Expert LCA, EPD, SimaPro software, verification services and training for government and corporate industries.">
      <meta name="author" content="SIPL Pvt Ltd">
      <title>SIPL Pvt Ltd - Sustainable Solution &amp; Assurance</title>
    </head>
    <body><a href="contact.html">Contact Us</a></body>
  </html>
`

const currentContactHtml = `
  <html>
    <head>
      <meta name="description" content="Contact SIPL Pvt Ltd — offices in Noida (HQ), Riyadh (Saudi Arabia), Delhi, and Gujarat.">
      <meta name="author" content="SIPL Pvt Ltd">
      <title>Contact Us - SIPL Pvt Ltd</title>
    </head>
    <body>
      <a href="tel:+919911921666">+91 9911921666</a>
      <a href="mailto:support@siplsustainability.com">support@siplsustainability.com</a>
      <label>Job Title</label><input name="job_title">
    </body>
  </html>
`

test('official site and contact signals are present while public careers routes are absent', async () => {
  const sipl = await loadSIPLModule()
  assert.ok(sipl)

  assert.equal(sipl.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(sipl.hasContactSignal(contactHtml), true)
  assert.equal(sipl.hasCareersSignal(homepageHtml), false)
})

test('run returns no jobs when SIPL only exposes company and contact pages publicly', async () => {
  const sipl = await loadSIPLModule()
  assert.ok(sipl)

  const requestedUrls = []
  const jobs = await sipl.createSIPLScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sipl.CAREER_PAGE_URL) {
        return homepageHtml
      }

      if (url === sipl.CONTACT_PAGE_URL) {
        return contactHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sipl.CAREER_PAGE_URL,
    sipl.CONTACT_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run follows the current linked contact page and does not mistake its enquiry Job Title field for an opening', async () => {
  const sipl = await loadSIPLModule()
  const requestedUrls = []

  assert.equal(sipl.hasOfficialSiteSignal(currentHomepageHtml), true)
  assert.equal(sipl.hasContactSignal(currentContactHtml), true)
  assert.equal(sipl.hasCareersSignal(currentContactHtml), false)
  assert.equal(sipl.CONTACT_PAGE_URL, 'https://www.sipl-sustainability.com/contact.html')

  const jobs = await sipl.createSIPLScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sipl.CAREER_PAGE_URL) return currentHomepageHtml
      if (url === sipl.CONTACT_PAGE_URL) return currentContactHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [sipl.CAREER_PAGE_URL, sipl.CONTACT_PAGE_URL])
  assert.deepEqual(jobs, [])
})
