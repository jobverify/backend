import assert from 'node:assert/strict'
import test from 'node:test'

import { hasVerifiedCareersSignal } from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Get Hired by Futran Solutions | Explore Openings</title>
      <link rel="canonical" href="https://futransolutions.com/careers/" />
    </head>
    <body>
      <h2>Careers</h2>
      <p>Futran Solutions is an Equal Opportunity Employer</p>
    </body>
  </html>
`

test('Futran Solutions accepts the lighter current no-openings careers shell', () => {
  assert.equal(hasVerifiedCareersSignal(careersHtml), true)
})
