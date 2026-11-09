import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHECKED_REDIRECT_ROUTE_URLS,
  MERGED_PARENT_HOMEPAGE_URL,
  createFincareScraper,
  hasMergedParentHomepageCloudflareSignal,
  isVerifiedMergedParentHomepage,
} from './script.js'

const auCloudflareChallengeHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Just a moment...</title>
    </head>
    <body>
      <main>
        <h1>Just a moment...</h1>
        <p>Enable JavaScript and cookies to continue</p>
      </main>
    </body>
  </html>
`

test('Fincare accepts the current AU homepage Cloudflare challenge as the verified merged parent surface', () => {
  assert.equal(hasMergedParentHomepageCloudflareSignal(auCloudflareChallengeHtml), true)
  assert.equal(
    isVerifiedMergedParentHomepage({
      status: 403,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: auCloudflareChallengeHtml,
    }),
    true,
  )
})

test('Fincare returns [] while the exact-name routes still hand off to the AU Cloudflare challenge page', async () => {
  const requestedUrls = []

  const jobs = await createFincareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url: MERGED_PARENT_HOMEPAGE_URL,
        html: auCloudflareChallengeHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    MERGED_PARENT_HOMEPAGE_URL,
    ...CHECKED_REDIRECT_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fincare still fails closed when the merged parent 403 page is not the verified AU challenge shell', async () => {
  await assert.rejects(
    createFincareScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url: MERGED_PARENT_HOMEPAGE_URL,
        html: url === MERGED_PARENT_HOMEPAGE_URL
          ? '<html><head><title>Access denied</title></head><body>Blocked.</body></html>'
          : auCloudflareChallengeHtml,
      }),
    }),
    /merged AU homepage/i,
  )
})
