import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, EXTERNAL_HANDOFF_URL, extractCareersRouteUrl, hasOfficialHomepageSignal, isExpectedCareersRedirect } from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Gameberry Labs | Makers of Ludo STAR &amp; Parchisi STAR</title>
    </head>
    <body>
      <h1>WE BUILD GAMES THAT PLAYERS LOVE TO GROW OLD WITH</h1>
      <h2>Build Your Dream Career With Us</h2>
      <p>Join our passion for gaming as we build the future of Indian mobile gaming studios - together</p>
      <p>We are an agile team of go-getters filled with people who want to build great games</p>
      <p>Bellandur Village</p>
      <a href="https://gameberrylabs.com/jobs">Careers</a>
    </body>
  </html>
`

test('Gameberry Labs accepts the current homepage copy and /jobs handoff', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(extractCareersRouteUrl(homepageHtml), CAREERS_URL)
  assert.equal(
    isExpectedCareersRedirect({
      status: 302,
      url: CAREERS_URL,
      location: EXTERNAL_HANDOFF_URL,
    }),
    true,
  )
})
