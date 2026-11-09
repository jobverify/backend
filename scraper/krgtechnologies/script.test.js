import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  CURRENT_OPENINGS_URL,
  EXTERNAL_BOARD_URL,
  hasCurrentOpeningsSignal,
  hasOfficialCareersSignal,
} from './script.js'

test('KRG Technologies uses the live apex-host careers URLs', () => {
  assert.equal(CAREERS_URL, 'https://krgtech.com/career.aspx')
  assert.equal(CURRENT_OPENINGS_URL, 'https://krgtech.com/Jobs.aspx')
})

test('KRG Technologies verifies the official careers page shell', () => {
  const html = `<!DOCTYPE html>
  <html>
  <head><title>KRG Technologies</title></head>
  <body>
    <nav><a href="/Jobs.aspx">Jobs</a></nav>
  </body>
  </html>`

  assert.equal(hasOfficialCareersSignal(html), true)
})

test('KRG Technologies verifies the current openings handoff page', () => {
  const html = `<!DOCTYPE html>
  <html>
  <body>
    <h1>Find Your Career. You Deserve it.</h1>
    <section>Current Openings</section>
    <iframe src="${EXTERNAL_BOARD_URL}"></iframe>
  </body>
  </html>`

  assert.equal(hasCurrentOpeningsSignal(html), true)
})
