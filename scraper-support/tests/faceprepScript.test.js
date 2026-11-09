import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  CONTACT_URL,
  HOMEPAGE_URL,
  createFacePrepScraper,
  hasContactSurfaceSignal,
  hasOfficialSiteSignal,
} from '../../scraper/faceprep/script.js'

const contactHtml = `
  <html lang="en-IN">
    <head>
      <title>Contact FACE Prep: Partnerships &amp; Enquiries</title>
      <link rel="canonical" href="https://faceprep.in/contact/">
    </head>
    <body>
      <img alt="FACE Prep" src="/images/brand/wordmark-on-light.svg">
      <p>Reach the FACE Prep team.</p>
      <footer>FACE Prep</footer>
    </body>
  </html>
`

test('FACE Prep scraper targets the official site and recognizes the current contact-surface careers route', () => {
  assert.equal(HOMEPAGE_URL, 'https://faceprep.in/')
  assert.equal(CAREERS_URL, 'https://faceprep.in/careers/')
  assert.equal(CONTACT_URL, 'https://faceprep.in/contact/')
  assert.equal(hasOfficialSiteSignal(contactHtml), true)
  assert.equal(hasContactSurfaceSignal(contactHtml), true)
})

test('run returns no jobs when the FACE Prep careers route resolves to the verified contact surface', async () => {
  const requestedUrls = []
  const jobs = await createFacePrepScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) {
        return {
          finalUrl: CONTACT_URL,
          html: contactHtml,
        }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when FACE Prep exposes a different careers surface', async () => {
  await assert.rejects(
    createFacePrepScraper().run({
      fetchPage: async () => ({
        finalUrl: CAREERS_URL,
        html: '<html><title>Unexpected</title></html>',
      }),
    }),
    /verified official public surface/i,
  )

  await assert.rejects(
    createFacePrepScraper().run({
      fetchPage: async () => ({
        finalUrl: CAREERS_URL,
        html: contactHtml,
      }),
    }),
    /no-public-careers contact surface/i,
  )
})
