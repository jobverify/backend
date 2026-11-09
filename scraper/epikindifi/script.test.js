import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createEpikindifiScraper,
  hasEmptyCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Home - Epikindifi - Digital Lending Platform Ecosystem</title>
    </head>
    <body>
      <h1>Digital Lending Made Simple & Effortless</h1>
      <a href="https://epikindifi.com/careers/">Careers</a>
      <a href="https://epikindifi.com/careers/">Apply Now</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Careers</h1>
      <section>Recent Posts</section>
      <a href="/hello-world">Hello world!</a>
      <a href="https://epikindifi.com/careers/">Apply Now</a>
    </body>
  </html>
`

test('validates the verified official EPIKInDiFi public surfaces and returns no structured jobs', async () => {
  const requestedUrls = []

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasEmptyCareersSignal(careersHtml), true)

  const jobs = await createEpikindifiScraper().run({
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

test('fails closed when the EPIKInDiFi homepage signal changes', async () => {
  await assert.rejects(
    createEpikindifiScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>No official signal</body></html>'
        return careersHtml
      },
    }),
    /verified official public site/i,
  )
})

test('fails closed when the EPIKInDiFi careers stub changes', async () => {
  await assert.rejects(
    createEpikindifiScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return '<html><body>Open positions table</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified empty public stub/i,
  )
})
