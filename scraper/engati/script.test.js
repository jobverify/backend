import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_EMAIL,
  CAREERS_URL,
  HOMEPAGE_URL,
  createEngatiScraper,
  hasCareersShellSignal,
  hasNoJobsSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Enterprise-grade AI-native Customer eXperience platform for revenue growth | Engati</title>
    </head>
    <body>
      <h1>Drive Revenue Growth across your Customer eXperience lifecycle</h1>
      <a href="https://www.engati.ai/careers">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Engati</title>
    </head>
    <body>
      <p>Check out our current openings or drop us a note at <a href="mailto:${CAREERS_EMAIL}">${CAREERS_EMAIL}</a>.</p>
      <input type="search" aria-label="Search roles and locations">
      <div>No items found.</div>
    </body>
  </html>
`

test('validates the verified official Engati public surfaces and empty-state careers shell', async () => {
  const requestedUrls = []

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasCareersShellSignal(careersHtml), true)
  assert.equal(hasNoJobsSignal(careersHtml), true)

  const jobs = await createEngatiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('fails closed when the Engati homepage signal changes', async () => {
  await assert.rejects(
    createEngatiScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>No careers link</body></html>'
        return careersHtml
      },
    }),
    /verified official public site/i,
  )
})

test('fails closed when the Engati careers empty-state signal changes', async () => {
  await assert.rejects(
    createEngatiScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return '<html><body>Open jobs table</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official empty-state public surface/i,
  )
})
