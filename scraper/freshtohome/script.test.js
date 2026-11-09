import assert from 'node:assert/strict'
import test from 'node:test'

import { hasOfficialHomepageSignal } from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>FreshToHome - Order Fresh Fish, Chicken and Mutton Online.</title>
    </head>
    <body>
      <p>Fish &amp; Seafood</p>
      <p>Poultry</p>
      <p>Mutton</p>
      <p>Sell-With-Us</p>
      <p>Certificates</p>
      <a href="mailto:customercare@freshtohome.com">Support</a>
    </body>
  </html>
`

test('FreshToHome accepts the current homepage shell without the retired Purple Member copy', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
})
