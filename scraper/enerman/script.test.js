import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTACT_URL,
  HOMEPAGE_URL,
  createEnerManScraper,
  hasOfficialContactSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>EnerMAN Technologies</h1>
      <p>EnerMAN Technologies Pvt. Ltd.</p>
      <nav>
        <a href="/products">Products</a>
        <a href="/contact/">Contact</a>
      </nav>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Let's Connect for Smarter Energy Solutions</h1>
      <p>Whether you're looking for customized SCADA systems or want to collaborate on a renewable energy project — we're here to help.</p>
      <form><input name="name"></form>
    </body>
  </html>
`

test('validates the verified official EnerMAN public surfaces and returns no structured jobs', async () => {
  const requestedUrls = []

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialContactSignal(contactHtml), true)

  const jobs = await createEnerManScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CONTACT_URL) return contactHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CONTACT_URL])
  assert.deepEqual(jobs, [])
})

test('fails closed when the EnerMAN homepage signal changes', async () => {
  await assert.rejects(
    createEnerManScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>No official company identity</body></html>'
        return contactHtml
      },
    }),
    /verified official public site/i,
  )
})

test('fails closed when the EnerMAN no-listings contact signal changes', async () => {
  await assert.rejects(
    createEnerManScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CONTACT_URL) return '<html><body>Current openings table</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official no-public-listings surface/i,
  )
})
