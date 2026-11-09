import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, createFronteggScraper, hasOfficialCareersPageSignal } from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Frontegg</title>
    </head>
    <body>
      <h1>Careers at Frontegg</h1>
      <h3>Current openings</h3>
      <div>We don't have any open positions at this time. Please visit again soon.</div>
    </body>
  </html>
`

test('Frontegg accepts the verified zero-openings careers state and returns []', async () => {
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)

  const jobs = await createFronteggScraper().run({
    fetchText: async (url) => {
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
