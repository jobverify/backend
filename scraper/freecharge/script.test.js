import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OFFICIAL_CAREERS_HANDOFF_URL,
  extractCareersHandoffUrl,
  hasVerifiedCareersPageSignal,
  hasVerifiedHomepageSignal,
  hasVerifiedJobBoardSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <p>Freecharge</p>
      <a href="https://careers.freecharge.in">Careers</a>
      <footer>Freecharge Payment Technologies Pvt. Ltd. All Rights Reserved</footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Freecharge</title>
    </head>
    <body>
      <p>#ChangeYourFuture</p>
      <p>Grow Your Career</p>
      <p>Explore open roles and join the team now.</p>
      <a href="https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list">View jobs</a>
    </body>
  </html>
`

const boardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Freecharge Careers | Latest jobs at Freecharge - Ripplehire.com</title>
    </head>
    <body>
      <p>Latest jobs at Freecharge</p>
    </body>
  </html>
`

test('FreeCharge accepts the current homepage slashless careers link and canonicalizes the RippleHire handoff URL', () => {
  assert.equal(hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(extractCareersHandoffUrl(careersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(hasVerifiedJobBoardSignal(boardHtml), true)
})
