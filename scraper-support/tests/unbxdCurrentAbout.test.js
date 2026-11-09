import assert from 'node:assert/strict'
import test from 'node:test'

import { ABOUT_URL, run } from '../../scraper/unbxd/script.js'

const currentAboutHtml = `
  <html><head><title>About Netcore Unbxd</title></head><body>
    <h1>The Unbxd Story</h1>
    <p>Connecting retailers and shoppers with sophisticated AI-based solutions.</p>
    <p>That's the problem we solve at Netcore Unbxd.</p>
  </body></html>
`

test('Unbxd uses the live exact-brand about surface without the TLS-broken trial host', async () => {
  const requested = []
  const jobs = await run({
    fetchHtml: async (url) => {
      requested.push(url)
      return currentAboutHtml
    },
  })
  assert.deepEqual(requested, [ABOUT_URL])
  assert.deepEqual(jobs, [])
})
