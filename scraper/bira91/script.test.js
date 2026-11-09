import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HOMEPAGE_URL,
  createBira91Scraper,
  hasVerifiedFirstParty404Signal,
  isBlockedNetworkError,
  isVerified404Page,
} from './script.js'

const verified404Html = `
<!doctype html>
<html lang="en">
  <body>
    <h1>404 Not Found</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const certificateMismatchError =
  "fetch failed | Hostname/IP does not match certificate's altnames: Host: bira91.com. is not in the cert's altnames: DNS:*.ksmart.live, DNS:ksmart.live"

test('Bira 91 recognizes the verified first-party 404 shell', () => {
  assert.equal(hasVerifiedFirstParty404Signal(verified404Html), true)
  assert.equal(
    isVerified404Page({
      status: 404,
      html: verified404Html,
    }),
    true,
  )
})

test('Bira 91 treats the current certificate mismatch as a blocked official surface', () => {
  assert.equal(isBlockedNetworkError(new Error(certificateMismatchError)), true)
  assert.equal(isBlockedNetworkError(new Error('net::ERR_CERT_COMMON_NAME_INVALID')), true)
})

test('Bira 91 returns no jobs when the official site is inaccessible behind the current certificate mismatch', async () => {
  const requestedUrls = []

  const jobs = await createBira91Scraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      throw new Error(certificateMismatchError)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})
