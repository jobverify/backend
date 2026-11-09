import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHECKED_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  VERIFIED_ON,
  createAynInfotechScraper,
  hasCompromisedHomepageSignal,
  isVerifiedUntrustedRoute,
} from './script.js'

const currentBigSkyHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Big Sky Worldview Forum | Billings, MT</title>
      <link rel="canonical" href="https://www.bigskyworldview.org" />
      <meta
        name="description"
        content="We seek to represent Christianity in the traditional, orthodox approach based upon the Bible as the inspired word of God."
      />
      <meta name="keywords" content="Big Sky Worldview Forum | Billings, MT" />
    </head>
    <body>
      <div id="app">Big Sky Worldview Forum</div>
    </body>
  </html>
`

const legacySlotHtml = `
  <html>
    <body>
      <h1>Deposit Pulsa Indosat</h1>
      <p>Slot pulsa gacor</p>
      <footer>Powered by Team</footer>
    </body>
  </html>
`

test('AYN InfoTech recognizes the verified compromised redirect markers', () => {
  assert.equal(SOURCE, 'ayninfotech')
  assert.equal(COMPANY, 'AYN InfoTech')
  assert.equal(VERIFIED_ON, '2026-08-07')
  assert.equal(HOMEPAGE_URL, 'https://www.ayninfotech.com/')
  assert.equal(CHECKED_ROUTE_URLS.length, 5)
  assert.equal(hasCompromisedHomepageSignal(currentBigSkyHtml), true)
  assert.equal(hasCompromisedHomepageSignal(legacySlotHtml), true)
  assert.equal(hasCompromisedHomepageSignal('<html><body><h1>AYN InfoTech</h1></body></html>'), false)
  assert.equal(
    isVerifiedUntrustedRoute({
      status: 200,
      url: 'https://www.bigskyworldview.org/',
      html: currentBigSkyHtml,
    }),
    true,
  )
})

test('AYN InfoTech returns an honest zero result while the first-party domain still redirects to Big Sky Worldview', async () => {
  const requestedUrls = []
  const jobs = await createAynInfotechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url: 'https://www.bigskyworldview.org/',
        html: currentBigSkyHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.ayninfotech.com/',
    ...CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('AYN InfoTech fails closed when the redirect target changes again', async () => {
  await assert.rejects(
    createAynInfotechScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: 'https://www.ayninfotech.com/',
        html: '<html><body><h1>AYN InfoTech</h1></body></html>',
      }),
    }),
    /verified untrusted domain state changed/i,
  )
})
