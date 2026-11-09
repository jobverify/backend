import assert from 'node:assert/strict'
import test from 'node:test'

import { hasVerifiedFordIndiaCareersPageSignal } from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Search our Job Opportunities at Ford Motor Company</title>
    </head>
    <body>
      <p>search results.</p>
      <h1>Search Jobs</h1>
      <p>Job Category</p>
      <p>Country: India</p>
      <p>Chennai, India</p>
    </body>
  </html>
`

test('Ford India accepts the current filtered Ford careers search page without requiring a stale sample role title', () => {
  assert.equal(hasVerifiedFordIndiaCareersPageSignal(careersHtml), true)
})
