import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_EMAIL,
  CAREERS_URL,
  CONTACT_URL,
  HOMEPAGE_URL,
  createEfficaAutomationScraper,
  hasApplicationOnlyCareersSignal,
  hasHiringContactSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Effica Automation Limited</title>
    </head>
    <body>
      <p>Effica Automation Limited, Coimbatore, India</p>
      <a href="careers.html">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>People at Effica</h1>
      <h2>Life at Effica</h2>
      <h2>Jobs at Effica</h2>
      <p>Register now to apply online.</p>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Contact Us</h1>
      <p>Business Enquiry Form</p>
      <form action="contact.php" method="post"></form>
      <a href="mailto:${CAREERS_EMAIL}">${CAREERS_EMAIL}</a>
    </body>
  </html>
`

test('validates the official Effica public surfaces and returns no structured jobs', async () => {
  const requestedUrls = []
  const scraper = createEfficaAutomationScraper()

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasApplicationOnlyCareersSignal(careersHtml), true)
  assert.equal(hasHiringContactSignal(contactHtml), true)

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
      if (url === CAREERS_URL) return { status: 200, url, headers: {}, html: careersHtml }
      if (url === CONTACT_URL) return { status: 200, url, headers: {}, html: contactHtml }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL, CONTACT_URL])
  assert.deepEqual(jobs, [])
})

test('fails closed when the Effica homepage signal changes', async () => {
  await assert.rejects(
    createEfficaAutomationScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, headers: {}, html: '<html><body>No careers link</body></html>' }
        if (url === CAREERS_URL) return { status: 200, url, headers: {}, html: careersHtml }
        return { status: 200, url, headers: {}, html: contactHtml }
      },
    }),
    /Effica homepage no longer matches the verified official public site/i,
  )
})

test('fails closed when the Effica careers surface changes', async () => {
  await assert.rejects(
    createEfficaAutomationScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
        if (url === CAREERS_URL) return { status: 200, url, headers: {}, html: '<html><body>Open jobs table</body></html>' }
        return { status: 200, url, headers: {}, html: contactHtml }
      },
    }),
    /Effica careers page no longer matches the verified official application-only surface/i,
  )
})

test('fails closed when the Effica hiring contact signal changes', async () => {
  await assert.rejects(
    createEfficaAutomationScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
        if (url === CAREERS_URL) return { status: 200, url, headers: {}, html: careersHtml }
        if (url === CONTACT_URL) return { status: 200, url, headers: {}, html: '<html><body>No HR contact</body></html>' }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Effica contact page no longer exposes the verified public hiring contact signal/i,
  )
})
