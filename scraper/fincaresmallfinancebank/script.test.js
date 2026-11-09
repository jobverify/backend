import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEGACY_HOMEPAGE_NO_WWW_URL,
  LEGACY_HOMEPAGE_URL,
  MERGED_PARENT_HOMEPAGE_URL,
  createFincareSmallFinanceBankScraper,
  isExpectedLegacyRetiredDomainFailure,
  isVerifiedMergedHomepageRedirect,
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

test('Fincare Small Finance Bank treats the current AU challenge page and retired legacy domains as the verified no-jobs surface', async () => {
  assert.equal(
    isVerifiedMergedHomepageRedirect({
      status: 403,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: auCloudflareChallengeHtml,
    }),
    true,
  )
  assert.equal(
    isExpectedLegacyRetiredDomainFailure(new Error('fetch failed | getaddrinfo ENOTFOUND www.fincarebank.com')),
    true,
  )

  const requestedUrls = []
  const jobs = await createFincareSmallFinanceBankScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === MERGED_PARENT_HOMEPAGE_URL) {
        return {
          status: 403,
          url,
          html: auCloudflareChallengeHtml,
        }
      }

      throw new Error(`fetch failed | getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    MERGED_PARENT_HOMEPAGE_URL,
    LEGACY_HOMEPAGE_URL,
    LEGACY_HOMEPAGE_NO_WWW_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Fincare Small Finance Bank does not swallow unexpected legacy-domain failures', async () => {
  await assert.rejects(
    createFincareSmallFinanceBankScraper().run({
      fetchPage: async (url) => {
        if (url === MERGED_PARENT_HOMEPAGE_URL) {
          return {
            status: 403,
            url,
            html: auCloudflareChallengeHtml,
          }
        }

        throw new Error('socket hang up')
      },
    }),
    /socket hang up/i,
  )
})
