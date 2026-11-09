import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HOMEPAGE_URL,
  SHUTDOWN_UPDATE_URL,
  createFrontRowScraper,
} from './script.js'

const mediumCloudflareBlockedHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Attention Required! | Cloudflare</title>
    </head>
    <body>
      <p>Please enable cookies.</p>
      <h1>Sorry, you have been blocked</h1>
      <p>You are unable to access medium.com</p>
      <p>Cloudflare Ray ID: 67ab3408dbe14921</p>
    </body>
  </html>
`

test('FrontRow returns [] when both public routes resolve to the verified Medium Cloudflare block on Thursday, August 13, 2026', async () => {
  const requestedUrls = []

  const jobs = await createFrontRowScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        ok: false,
        status: 403,
        url: SHUTDOWN_UPDATE_URL,
        text: mediumCloudflareBlockedHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, SHUTDOWN_UPDATE_URL])
  assert.deepEqual(jobs, [])
})
